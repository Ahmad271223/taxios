import { LoginForm } from "@/components/LoginForm";

export default function FahrerLoginPage() {
  return (
    <LoginForm
      role="DRIVER"
      redirectTo="/fahrer"
      title="Fahrerportal"
      hint="Demo-Zugang: fahrer1 … fahrer6  /  taxi123"
    />
  );
}
