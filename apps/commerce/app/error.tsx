'use client';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="wrap empty-state"><h1>A small pause in the story.</h1><p>We couldn't load this page. Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></div>;
}
