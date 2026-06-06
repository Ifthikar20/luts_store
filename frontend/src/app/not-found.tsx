import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-xl flex min-h-[70vh] flex-col items-center justify-center pt-36 text-center">
      <p className="font-display text-8xl font-bold text-grade-teal">404</p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-white">
        This look got lost in the grade.
      </h1>
      <p className="mt-3 max-w-md text-white/55">
        The page you&apos;re after doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className="btn-grade mt-8">
        Back to home
      </Link>
    </div>
  );
}
