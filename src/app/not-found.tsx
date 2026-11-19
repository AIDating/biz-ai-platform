import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <Logo />
        <h1 className="mt-8 text-4xl">404</h1>
        <p className="mt-2 text-muted-foreground">Pagina nu există. / This page does not exist.</p>
      </div>
    </div>
  );
}
