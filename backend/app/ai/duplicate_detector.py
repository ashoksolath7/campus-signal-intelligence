import logging
import re
from typing import Any

from app.ai.embedding import EmbeddingEngine

logger = logging.getLogger(__name__)

SYNONYMS: dict[str, str] = {
    "wi-fi": "wifi",
    "internet": "wifi",
    "lan": "wifi",
    "connection": "network",
    "air conditioning": "aircon",
    "air conditioner": "aircon",
    "a/c": "aircon",
    "ac": "aircon",
    "cooling": "aircon",
    "water leak": "waterleak",
    "leaking": "leak",
    "leakage": "leak",
    "dripping": "leak",
    "not working": "broken",
    "out of order": "broken",
    "faulty": "broken",
    "damaged": "broken",
    "down": "broken",
    "restroom": "washroom",
    "toilet": "washroom",
    "bathroom": "washroom",
    "dorm": "hostel",
    "dormitory": "hostel",
    "1st": "first",
    "2nd": "second",
    "3rd": "third",
    "4th": "fourth",
    "5th": "fifth",
}

STOP_WORDS = {
    "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "is", "are", "was",
    "were", "has", "have", "had", "been", "it", "this", "that", "there", "my", "our",
    "please", "help", "very", "every", "since", "can", "cannot", "cant"
}


def normalize_text(text: str) -> str:
    cleaned = text.lower()
    for phrase, replacement in SYNONYMS.items():
        cleaned = re.sub(r"\b" + re.escape(phrase) + r"\b", replacement, cleaned)
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    return " ".join(cleaned.split())


def extract_keywords(text: str) -> set[str]:
    norm = normalize_text(text)
    words = norm.split()
    return {w for w in words if len(w) > 2 and w not in STOP_WORDS}


class DuplicateDetector:
    """High-accuracy campus complaint duplicate detector using dense sentence embeddings and lexical evidence."""

    @classmethod
    def compute_similarity_details(
        cls,
        title_a: str,
        desc_a: str,
        cat_a: str | None,
        loc_a: str | None,
        title_b: str,
        desc_b: str,
        cat_b: str | None,
        loc_b: str | None,
    ) -> dict[str, Any]:
        text_a = f"{title_a}. {desc_a}".strip()
        text_b = f"{title_b}. {desc_b}".strip()

        kw_a = extract_keywords(text_a)
        kw_b = extract_keywords(text_b)
        matching_kws = sorted(list(kw_a & kw_b))

        # 1. Dense Sentence Embedding Cosine Similarity
        emb_a = EmbeddingEngine.encode(text_a)
        emb_b = EmbeddingEngine.encode(text_b)
        dense_sim = EmbeddingEngine.cosine_similarity(emb_a, emb_b)

        # 2. Token Jaccard Similarity (lexical anchor)
        norm_a = normalize_text(text_a)
        norm_b = normalize_text(text_b)
        tokens_a = set(norm_a.split())
        tokens_b = set(norm_b.split())
        union = tokens_a | tokens_b
        jaccard = (len(tokens_a & tokens_b) / len(union)) if union else 0.0

        # Weighted combination: 70% dense semantic + 30% lexical Jaccard
        base_score = 0.70 * dense_sim + 0.30 * jaccard

        # 3. Contextual Metadata Boosts
        boost = 0.0
        evidence_factors: list[str] = []

        if dense_sim >= 0.70:
            evidence_factors.append(f"{int(dense_sim * 100)}% dense semantic alignment")
        elif dense_sim >= 0.50:
            evidence_factors.append(f"{int(dense_sim * 100)}% moderate semantic similarity")

        if matching_kws:
            evidence_factors.append(f"matching keywords: {', '.join(matching_kws[:4])}")

        # Category bonus
        if cat_a and cat_b and cat_a.lower() == cat_b.lower():
            boost += 0.10
            evidence_factors.append(f"shared category '{cat_a.lower()}'")

        # Location bonus (if normalized location tokens overlap)
        if loc_a and loc_b:
            norm_loc_a = set(normalize_text(loc_a).split()) - STOP_WORDS
            norm_loc_b = set(normalize_text(loc_b).split()) - STOP_WORDS
            shared_loc = norm_loc_a & norm_loc_b
            if shared_loc:
                boost += 0.15
                evidence_factors.append(f"shared location context '{', '.join(sorted(shared_loc))}'")

        final_score = min(1.0, max(0.0, base_score + boost))
        evidence_str = "; ".join(evidence_factors) if evidence_factors else "Lexical and semantic feature alignment"

        return {
            "similarity_score": round(final_score, 3),
            "dense_similarity": round(dense_sim, 3),
            "matching_keywords": matching_kws,
            "evidence": evidence_str,
            "engine": EmbeddingEngine.get_engine_name(),
        }

    @classmethod
    def compute_similarity(
        cls,
        title_a: str,
        desc_a: str,
        cat_a: str | None,
        loc_a: str | None,
        title_b: str,
        desc_b: str,
        cat_b: str | None,
        loc_b: str | None,
    ) -> tuple[float, list[str]]:
        """Legacy compatibility method returning (similarity_score, matching_keywords)."""
        details = cls.compute_similarity_details(
            title_a=title_a,
            desc_a=desc_a,
            cat_a=cat_a,
            loc_a=loc_a,
            title_b=title_b,
            desc_b=desc_b,
            cat_b=cat_b,
            loc_b=loc_b,
        )
        return details["similarity_score"], details["matching_keywords"]

    @classmethod
    def find_duplicates(
        cls,
        title: str,
        description: str,
        category: str | None,
        location: str | None,
        candidates: list[dict[str, Any]],
        threshold: float = 0.50,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []

        for c in candidates:
            c_title = c.get("title", "")
            c_desc = c.get("description", "")
            c_cat = c.get("category")
            c_loc = c.get("location")

            details = cls.compute_similarity_details(
                title_a=title,
                desc_a=description,
                cat_a=category,
                loc_a=location,
                title_b=c_title,
                desc_b=c_desc,
                cat_b=c_cat,
                loc_b=c_loc,
            )

            sim = details["similarity_score"]
            if sim >= threshold:
                matching_kws = details["matching_keywords"]
                summary_text = (
                    f"{int(sim * 100)}% match ({details['evidence']})"
                    if details["evidence"]
                    else f"{int(sim * 100)}% semantic similarity"
                )

                results.append({
                    "complaint_id": c.get("id", ""),
                    "ticket": c.get("ticket", ""),
                    "title": c_title,
                    "category": c_cat or "facilities",
                    "status": c.get("status", "submitted"),
                    "priority": c.get("priority", "medium"),
                    "similarity_score": sim,
                    "dense_similarity": details["dense_similarity"],
                    "duplicate_group_id": c.get("duplicate_group_id"),
                    "matching_keywords": matching_kws[:8],
                    "summary": summary_text,
                    "evidence": details["evidence"],
                    "engine": details["engine"],
                })

        # Sort descending by similarity score
        results.sort(key=lambda item: item["similarity_score"], reverse=True)
        return results[:limit]

    @classmethod
    def cluster_candidates(
        cls,
        complaints: list[dict[str, Any]],
        threshold: float = 0.55,
    ) -> list[dict[str, Any]]:
        """Find clusters of complaints that have high mutual semantic similarity.
        
        NOTE: This only suggests clusters for administrative review.
        Complaints are NEVER merged automatically without explicit admin confirmation.
        """
        n = len(complaints)
        if n < 2:
            return []

        # Disjoint Set Union (Union-Find)
        parent = list(range(n))

        def find(i: int) -> int:
            if parent[i] == i:
                return i
            parent[i] = find(parent[i])
            return parent[i]

        def union(i: int, j: int) -> None:
            root_i = find(i)
            root_j = find(j)
            if root_i != root_j:
                parent[root_i] = root_j

        pairwise_sim: dict[tuple[int, int], float] = {}
        pairwise_evidence: dict[tuple[int, int], str] = {}

        for i in range(n):
            for j in range(i + 1, n):
                c_i = complaints[i]
                c_j = complaints[j]
                details = cls.compute_similarity_details(
                    title_a=c_i.get("title", ""),
                    desc_a=c_i.get("description", ""),
                    cat_a=c_i.get("category"),
                    loc_a=c_i.get("location"),
                    title_b=c_j.get("title", ""),
                    desc_b=c_j.get("description", ""),
                    cat_b=c_j.get("category"),
                    loc_b=c_j.get("location"),
                )
                sim = details["similarity_score"]
                if sim >= threshold:
                    union(i, j)
                    pairwise_sim[(i, j)] = sim
                    pairwise_evidence[(i, j)] = details["evidence"]

        # Group components
        clusters: dict[int, list[int]] = {}
        for idx in range(n):
            root = find(idx)
            clusters.setdefault(root, []).append(idx)

        suggested_groups: list[dict[str, Any]] = []
        for root, indices in clusters.items():
            if len(indices) < 2:
                continue

            primary_idx = indices[0]
            primary_c = complaints[primary_idx]
            member_indices = indices[1:]

            # Calculate average similarity in cluster
            cluster_sims = [
                pairwise_sim.get((min(a, b), max(a, b)), threshold)
                for a in indices for b in indices if a != b
            ]
            avg_sim = round(sum(cluster_sims) / len(cluster_sims), 2) if cluster_sims else threshold

            # Gather sample evidence
            sample_evidence = [
                pairwise_evidence.get((min(a, b), max(a, b)))
                for a in indices for b in indices if (min(a, b), max(a, b)) in pairwise_evidence
            ]
            combined_evidence = "; ".join(filter(None, sample_evidence[:2]))

            suggested_groups.append({
                "group_id": f"ai-dup-{primary_c.get('ticket', 'grp').lower()}",
                "primary_ticket": primary_c.get("ticket", ""),
                "primary_id": primary_c.get("id", ""),
                "member_tickets": [complaints[k].get("ticket", "") for k in member_indices],
                "member_ids": [complaints[k].get("id", "") for k in member_indices],
                "common_theme": primary_c.get("title", ""),
                "average_similarity": avg_sim,
                "evidence": combined_evidence or f"{int(avg_sim * 100)}% average semantic cluster affinity",
                "engine": EmbeddingEngine.get_engine_name(),
            })

        return suggested_groups
