"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentPack } from "@/lib/repurposer/schema";
import { CardShell } from "@/components/repurposer/CardShell";
import { AutosizeTextarea } from "@/components/repurposer/AutosizeTextarea";

type Props = {
  pack: ContentPack;
};

export function ContentPackView({ pack }: Props) {
  const [draft, setDraft] = useState<ContentPack>(pack);

  useEffect(() => {
    setDraft(pack);
  }, [pack]);

  const fullCopy = useMemo(() => buildFullCopy(draft), [draft]);

  function updateLinkedIn(index: number, text: string) {
    setDraft((d) => ({
      ...d,
      linkedinPosts: d.linkedinPosts.map((p, i) =>
        i === index ? { ...p, text } : p,
      ),
    }));
  }

  function updateEmailField<K extends "subject" | "previewText" | "body">(
    field: K,
    value: string,
  ) {
    setDraft((d) => ({ ...d, email: { ...d.email, [field]: value } }));
  }

  function updateEmailCta(field: "text" | "url", value: string) {
    setDraft((d) => ({
      ...d,
      email: { ...d.email, cta: { ...d.email.cta, [field]: value } },
    }));
  }

  function updateQuote(
    index: number,
    field: "quote" | "approxTimestamp",
    value: string,
  ) {
    setDraft((d) => ({
      ...d,
      pullQuotes: d.pullQuotes.map((q, i) =>
        i === index ? { ...q, [field]: value } : q,
      ),
    }));
  }

  function updateBlogTitle(value: string) {
    setDraft((d) => ({ ...d, blogOutline: { ...d.blogOutline, title: value } }));
  }

  function updateBlogHeading(sIdx: number, value: string) {
    setDraft((d) => ({
      ...d,
      blogOutline: {
        ...d.blogOutline,
        sections: d.blogOutline.sections.map((s, i) =>
          i === sIdx ? { ...s, heading: value } : s,
        ),
      },
    }));
  }

  function updateBlogBullet(sIdx: number, bIdx: number, value: string) {
    setDraft((d) => ({
      ...d,
      blogOutline: {
        ...d.blogOutline,
        sections: d.blogOutline.sections.map((s, i) =>
          i === sIdx
            ? {
                ...s,
                bullets: s.bullets.map((b, j) => (j === bIdx ? value : b)),
              }
            : s,
        ),
      },
    }));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Your content pack
        </h2>
        <CopyAllButton text={fullCopy} />
      </div>

      <section className="space-y-3">
        <SectionHeader title="LinkedIn posts" subtitle="3 angles, your voice" />
        <div className="grid gap-4 lg:grid-cols-3">
          {draft.linkedinPosts.map((post, i) => (
            <CardShell
              key={i}
              title={`LinkedIn post ${i + 1}`}
              copyText={post.text}
            >
              <AutosizeTextarea
                value={post.text}
                onChange={(e) => updateLinkedIn(i, e.target.value)}
                rows={10}
              />
              <div className="mt-2 text-xs text-slate-500">
                {wordCount(post.text)} words
              </div>
            </CardShell>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Promo email" />
        <CardShell
          title="Email"
          copyText={emailToCopy(draft.email)}
        >
          <div className="space-y-3">
            <Field label="Subject">
              <AutosizeTextarea
                value={draft.email.subject}
                onChange={(e) => updateEmailField("subject", e.target.value)}
                rows={1}
              />
              <CharHint count={draft.email.subject.length} target="40–60" />
            </Field>
            <Field label="Preview text">
              <AutosizeTextarea
                value={draft.email.previewText}
                onChange={(e) => updateEmailField("previewText", e.target.value)}
                rows={1}
              />
              <CharHint count={draft.email.previewText.length} target="60–100" />
            </Field>
            <Field label="Body">
              <AutosizeTextarea
                value={draft.email.body}
                onChange={(e) => updateEmailField("body", e.target.value)}
                rows={8}
              />
              <div className="mt-1 text-xs text-slate-500">
                {wordCount(draft.email.body)} words
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="CTA text">
                <AutosizeTextarea
                  value={draft.email.cta.text}
                  onChange={(e) => updateEmailCta("text", e.target.value)}
                  rows={1}
                />
              </Field>
              <Field label="CTA URL (optional)">
                <AutosizeTextarea
                  value={draft.email.cta.url ?? ""}
                  onChange={(e) => updateEmailCta("url", e.target.value)}
                  rows={1}
                  placeholder="https://..."
                />
              </Field>
            </div>
          </div>
        </CardShell>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Pull quotes"
          subtitle="For Reels / Shorts / LinkedIn video"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {draft.pullQuotes.map((q, i) => (
            <CardShell
              key={i}
              title={`Pull quote ${i + 1}`}
              badge={q.approxTimestamp}
              copyText={`"${q.quote}" — ${q.approxTimestamp}`}
            >
              <div className="space-y-2">
                <AutosizeTextarea
                  value={q.quote}
                  onChange={(e) => updateQuote(i, "quote", e.target.value)}
                  rows={3}
                />
                <Field label="Approx. timestamp">
                  <AutosizeTextarea
                    value={q.approxTimestamp}
                    onChange={(e) =>
                      updateQuote(i, "approxTimestamp", e.target.value)
                    }
                    rows={1}
                  />
                </Field>
              </div>
            </CardShell>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Blog outline" />
        <CardShell
          title="Blog"
          copyText={blogToCopy(draft.blogOutline)}
        >
          <div className="space-y-4">
            <Field label="Title">
              <AutosizeTextarea
                value={draft.blogOutline.title}
                onChange={(e) => updateBlogTitle(e.target.value)}
                rows={1}
              />
            </Field>
            <div className="space-y-4">
              {draft.blogOutline.sections.map((section, sIdx) => (
                <div
                  key={sIdx}
                  className="rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                >
                  <Field label={`Section ${sIdx + 1} heading`}>
                    <AutosizeTextarea
                      value={section.heading}
                      onChange={(e) => updateBlogHeading(sIdx, e.target.value)}
                      rows={1}
                    />
                  </Field>
                  <div className="mt-2 space-y-2">
                    {section.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex gap-2">
                        <span className="mt-2 text-slate-400">•</span>
                        <AutosizeTextarea
                          value={bullet}
                          onChange={(e) =>
                            updateBlogBullet(sIdx, bIdx, e.target.value)
                          }
                          rows={1}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardShell>
      </section>
    </div>
  );
}

function CopyAllButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
    >
      {copied ? "Copied all" : "Copy all"}
    </button>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle && (
        <span className="text-xs text-slate-500">{subtitle}</span>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function CharHint({ count, target }: { count: number; target: string }) {
  return (
    <div className="mt-1 text-xs text-slate-500">
      {count} characters · target {target}
    </div>
  );
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function emailToCopy(email: ContentPack["email"]) {
  const ctaLine = email.cta.url
    ? `${email.cta.text} → ${email.cta.url}`
    : email.cta.text;
  return [
    `Subject: ${email.subject}`,
    `Preview: ${email.previewText}`,
    "",
    email.body,
    "",
    `CTA: ${ctaLine}`,
  ].join("\n");
}

function blogToCopy(blog: ContentPack["blogOutline"]) {
  const lines = [`# ${blog.title}`, ""];
  blog.sections.forEach((s, i) => {
    lines.push(`## ${i + 1}. ${s.heading}`);
    s.bullets.forEach((b) => lines.push(`- ${b}`));
    lines.push("");
  });
  return lines.join("\n").trim();
}

function buildFullCopy(pack: ContentPack) {
  const parts: string[] = [];
  parts.push("=== LINKEDIN POSTS ===");
  pack.linkedinPosts.forEach((p, i) => {
    parts.push(`\n--- Post ${i + 1} ---\n${p.text}`);
  });
  parts.push("\n\n=== PROMO EMAIL ===");
  parts.push(emailToCopy(pack.email));
  parts.push("\n\n=== PULL QUOTES ===");
  pack.pullQuotes.forEach((q, i) => {
    parts.push(`\n${i + 1}. [${q.approxTimestamp}] "${q.quote}"`);
  });
  parts.push("\n\n=== BLOG OUTLINE ===");
  parts.push(blogToCopy(pack.blogOutline));
  return parts.join("\n");
}
