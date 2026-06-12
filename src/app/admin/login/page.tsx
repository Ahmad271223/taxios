import { LoginForm } from "@/components/LoginForm";

export default function AdminLoginPage() {
  return (
    <LoginForm
      role="ADMIN"
      redirectTo="/admin"
      title="Zentrale / Firmen-Login"
      identifierLabel="E-Mail"
      identifierType="email"
      hint="Demo-Zugang: admin@citytaxi.de  /  admin123"
      showRegister
    />
  );
}
