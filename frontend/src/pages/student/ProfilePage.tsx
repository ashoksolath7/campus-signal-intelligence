import { useState } from "react";

import { PageHeader } from "../../components/layout/PageHeader";
import { Alert } from "../../components/ui/Alert";
import { Button } from "../../components/ui/Button";
import { Card, CardBody } from "../../components/ui/Card";
import { Field, TextInput } from "../../components/ui/Field";
import { useAuth } from "../../context/AuthContext";
import { required } from "../../utils/validation";

export function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="View and update your student account profile information." />
      {saved ? <Alert tone="success">Profile saved successfully.</Alert> : null}
      <Card>
        <CardBody>
          <form
            className="grid max-w-xl gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const nameError = required(name, "Name");
              if (nameError) {
                setError(nameError);
                setSaved(false);
                return;
              }
              updateProfile({ name: name.trim(), phone: phone.trim() });
              setError("");
              setSaved(true);
            }}
          >
            <Field label="Full name" htmlFor="name" error={error}>
              <TextInput id="name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Email" htmlFor="email">
              <TextInput id="email" value={user?.email ?? ""} disabled />
            </Field>
            <Field label="Student ID" htmlFor="studentId">
              <TextInput id="studentId" value={user?.studentId ?? "Not assigned"} disabled />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <TextInput id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <div>
              <Button type="submit" className="w-full sm:w-auto min-h-[44px]">Save profile</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
