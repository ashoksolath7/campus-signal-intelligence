import json
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

# Categories and their lexical keywords
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "safety": [
        "fire", "smoke", "spark", "sparks", "sparking", "electric shock", "shock", "live wire",
        "exposed wire", "electrical wire", "wire", "wires", "hazard", "gas leak", "gas", "smell",
        "theft", "stolen", "burglary", "broke into", "assault", "harassment", "threat", "danger",
        "dangerous", "emergency", "injury", "hurt", "blood", "security guard", "security",
        "dark alley", "broken glass"
    ],
    "facilities": [
        "plumbing", "pipe", "water leak", "leak", "leaking", "drainage", "faucet", "tap",
        "toilet", "restroom", "washroom", "roof", "ceiling", "door", "window", "elevator",
        "lift", "lighting", "light bulb", "light", "fan", "electricity", "socket", "switch",
        "ac", "air conditioner", "air conditioning", "cooling", "heating", "chair", "desk",
        "bench", "furniture", "whiteboard", "blackboard", "cleaning", "trash", "garbage"
    ],
    "it": [
        "wifi", "wi-fi", "internet", "network", "lan", "ethernet", "router", "portal",
        "login", "password", "canvas", "moodle", "lms", "email", "server", "projector",
        "audio", "sound", "screen", "monitor", "software", "printer", "printing", "bug"
    ],
    "hostel": [
        "hostel", "dorm", "dormitory", "room", "roommate", "bed", "mattress", "mess",
        "food", "dining", "warden", "curfew", "hot water", "geyser", "laundry", "washing machine",
        "cooler"
    ],
    "transport": [
        "bus", "shuttle", "transport", "cab", "parking", "bike", "cycle", "driver",
        "route", "bus schedule", "commute", "transit", "van"
    ],
    "academics": [
        "exam", "exams", "midterm", "final", "examination", "test", "quiz", "grade", "grading",
        "marks", "professor", "faculty", "teacher", "attendance", "lecture", "class",
        "course", "syllabus", "transcript", "registrar", "credits", "assignment",
        "timetable", "schedule conflict", "gpa"
    ],
}

DEPARTMENT_MAP: dict[str, tuple[str, str, str]] = {
    "facilities": ("Estate & Facilities Office", "FAC", "Responsible for campus buildings, plumbing, HVAC, and electrical physical upkeep."),
    "it": ("Campus IT Services", "IT", "Responsible for network infrastructure, student portals, and lab hardware."),
    "hostel": ("Hostel Administration", "HST", "Responsible for residential dormitories, student housing, and mess facilities."),
    "safety": ("Campus Security & Safety", "SEC", "Responsible for physical security, emergency hazard mitigation, and student safety."),
    "transport": ("Transport Operations", "TRN", "Responsible for university shuttles, buses, and vehicular transport schedules."),
    "academics": ("Academic Affairs & Registrar", "ACD", "Responsible for course administration, examinations, grades, and faculty logistics."),
    "other": ("General Student Affairs", "GEN", "General campus inquiries and non-specialized operational requests."),
}

CRITICAL_TRIGGERS = [
    "live wire", "exposed wire", "electrical wire", "electric wire", "electric shock",
    "sparking", "fire", "smoke", "gas leak", "structural collapse", "ceiling collapse",
    "assault", "immediate danger", "hazard"
]

HIGH_TRIGGERS = [
    "blackout", "power outage", "no water", "overflowing", "exam tomorrow",
    "exam in 1 hour", "theft", "broken lock", "door broken", "wifi down during exam"
]


class DomainHeuristicClassifier:
    """Deterministic, high-accuracy campus domain classifier with structured explainability."""

    @classmethod
    def classify(
        cls,
        title: str,
        description: str,
        location: str | None = None,
    ) -> dict[str, Any]:
        text = f"{title} {description} {location or ''}".lower()

        # 1. Score categories and collect matched keyword evidence
        cat_scores: dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}
        matched_indicators: dict[str, list[str]] = {cat: [] for cat in CATEGORY_KEYWORDS}

        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                # Use word boundary matching to avoid matching substrings like 'ac' in 'feedback'
                pattern = r"\b" + re.escape(kw) + r"\b"
                if re.search(pattern, text):
                    weight = 3 if re.search(pattern, title.lower()) else 1
                    cat_scores[cat] += weight
                    matched_indicators[cat].append(kw)

        # Determine best category
        best_category = "facilities"
        max_score = 0
        for cat, score in cat_scores.items():
            if score > max_score:
                max_score = score
                best_category = cat

        if max_score == 0:
            best_category = "other"

        # Calculate category confidence (bounded between 0.40 and 0.98)
        total_score = sum(cat_scores.values())
        if total_score > 0:
            cat_confidence = round(min(0.98, max(0.45, max_score / (total_score * 0.75))), 2)
        else:
            cat_confidence = 0.35

        # Format explainability reasons for category
        cat_kws = matched_indicators.get(best_category, [])
        if cat_kws:
            category_reasons = [
                f"Identified core {best_category} concepts: {', '.join(cat_kws[:4])}",
                f"Highest weighted domain match score ({max_score} signal points)",
            ]
        else:
            category_reasons = ["Generic campus issue defaulted to standard student services."]

        # 2. Determine Priority & Urgency Score with Trigger Explainability
        critical_matches = [trig for trig in CRITICAL_TRIGGERS if trig in text]
        high_matches = [trig for trig in HIGH_TRIGGERS if trig in text]

        priority_reasons: list[str] = []

        if critical_matches or (best_category == "safety" and max_score >= 3):
            priority = "critical"
            urgency_score = 0.95
            reasoning = "Critical safety or infrastructure hazard identified requiring immediate dispatch."
            if critical_matches:
                priority_reasons.append(f"Severe safety/hazard keywords detected: {', '.join(critical_matches)}")
            priority_reasons.append("High urgency score assigned to prevent injury or campus disruption.")
        elif high_matches or max_score >= 4 or (best_category == "safety"):
            priority = "high"
            urgency_score = 0.78
            reasoning = "Significant campus service disruption or security concern affecting student operations."
            if high_matches:
                priority_reasons.append(f"High-impact service disruption triggers: {', '.join(high_matches)}")
            priority_reasons.append("Escalated response recommended within 4-8 hours.")
        elif max_score >= 2 or best_category in ["it", "hostel", "facilities"]:
            priority = "medium"
            urgency_score = 0.52
            reasoning = "Standard operational maintenance issue requiring scheduled staff intervention."
            priority_reasons.append("Standard operational SLA (24-48 hours).")
        else:
            priority = "low"
            urgency_score = 0.25
            reasoning = "Routine feedback or minor maintenance with low operational impact."
            priority_reasons.append("Non-urgent operational review schedule.")

        dept_name, dept_code, dept_desc = DEPARTMENT_MAP.get(
            best_category, ("General Student Affairs", "GEN", "General campus inquiries.")
        )

        cleaned_title = title.strip()
        summary = f"{priority.capitalize()} priority {best_category} ticket: {cleaned_title}"

        return {
            "category": best_category,
            "category_confidence": cat_confidence,
            "category_reasons": category_reasons,
            "priority": priority,
            "priority_reasons": priority_reasons,
            "urgency_score": urgency_score,
            "summary": summary,
            "reasoning": reasoning,
            "department_hint": dept_name,
            "department_code": dept_code,
            "department_reasoning": f"Routed to {dept_name} ({dept_code}): {dept_desc}",
            "model_used": "domain-heuristic-engine (rule-based fallback)",
        }


class GeminiClassifier:
    """AI Classifier powered by Google Gemini with graceful fallback to heuristic engine."""

    @classmethod
    def classify(
        cls,
        title: str,
        description: str,
        location: str | None = None,
    ) -> dict[str, Any]:
        api_key = settings.gemini_api_key.strip()
        if not api_key:
            # No API key provided in environment, use explainable domain heuristics
            return DomainHeuristicClassifier.classify(title, description, location)

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            prompt = (
                f"You are the Campus Signal Intelligence triage system. "
                f"Classify the following campus student complaint into structured JSON.\n\n"
                f"Title: {title}\n"
                f"Description: {description}\n"
                f"Location: {location or 'Not specified'}\n\n"
                f"Allowed categories: facilities, academics, hostel, it, safety, transport, other.\n"
                f"Allowed priorities: low, medium, high, critical.\n\n"
                f"Return a valid JSON object with keys:\n"
                f"- category (string, from allowed list)\n"
                f"- category_confidence (float between 0.0 and 1.0)\n"
                f"- category_reasons (list of strings explaining why category was chosen)\n"
                f"- priority (string, from allowed list)\n"
                f"- priority_reasons (list of strings explaining why priority was chosen)\n"
                f"- urgency_score (float between 0.0 and 1.0)\n"
                f"- summary (one concise sentence describing the issue)\n"
                f"- reasoning (short overall explanation of the classification)\n"
                f"- department_hint (suggested campus department name)\n"
                f"- department_reasoning (short explanation of department routing)"
            )

            response = client.models.generate_content(
                model=settings.gemini_model or "gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )

            data = json.loads(response.text)
            cat = str(data.get("category", "facilities")).lower()
            dept_info = DEPARTMENT_MAP.get(cat, ("General Student Affairs", "GEN", "General campus inquiries."))

            return {
                "category": cat,
                "category_confidence": float(data.get("category_confidence", 0.90)),
                "category_reasons": list(data.get("category_reasons", [f"Gemini LLM classified into {cat}"])),
                "priority": str(data.get("priority", "medium")).lower(),
                "priority_reasons": list(data.get("priority_reasons", ["Assessed via Gemini severity evaluation"])),
                "urgency_score": float(data.get("urgency_score", 0.5)),
                "summary": str(data.get("summary", title)),
                "reasoning": str(data.get("reasoning", "Classified using Gemini AI.")),
                "department_hint": data.get("department_hint") or dept_info[0],
                "department_code": dept_info[1],
                "department_reasoning": str(data.get("department_reasoning", dept_info[2])),
                "model_used": f"gemini-{settings.gemini_model}",
            }
        except Exception as exc:
            logger.warning(
                "Gemini AI classification failed or unavailable (%s). Falling back to domain heuristic engine.",
                exc,
            )
            fallback = DomainHeuristicClassifier.classify(title, description, location)
            fallback["reasoning"] += f" (Gemini fallback: {type(exc).__name__})"
            return fallback
