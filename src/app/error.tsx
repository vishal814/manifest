"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="standalone-state"><span className="eyebrow accent">CONNECTION INTERRUPTED</span><h1>We couldn’t load this view.</h1><p>Your saved records are unchanged. Check your workspace connection and database setup, then try again.</p><button className="button primary" onClick={reset}>Try again</button><a href="/setup" className="back-link">View setup guide</a></main>;
}
