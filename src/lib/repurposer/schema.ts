import { z } from "zod";

export const ContentPackSchema = z.object({
  linkedinPosts: z
    .array(
      z.object({
        text: z.string().min(1),
      }),
    )
    .length(3),
  email: z.object({
    subject: z.string().min(1),
    previewText: z.string().min(1),
    body: z.string().min(1),
    cta: z.object({
      text: z.string().min(1),
      url: z.string().optional(),
    }),
  }),
  pullQuotes: z
    .array(
      z.object({
        quote: z.string().min(1),
        approxTimestamp: z.string().min(1),
      }),
    )
    .length(5),
  blogOutline: z.object({
    title: z.string().min(1),
    sections: z
      .array(
        z.object({
          heading: z.string().min(1),
          bullets: z.array(z.string().min(1)).min(1),
        }),
      )
      .min(4)
      .max(6),
  }),
});

export type ContentPack = z.infer<typeof ContentPackSchema>;

export const CONTENT_PACK_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    linkedinPosts: {
      type: "array",
      description:
        "Exactly 3 LinkedIn posts in WSP voice. Each post attacks the webinar topic from a different angle.",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description:
              "Full LinkedIn post body, 120–220 words, with line breaks for rhythm. Ends with one specific CTA. No 'Learn more'.",
          },
        },
        required: ["text"],
      },
    },
    email: {
      type: "object",
      description: "One promo email for WSP's mailing list.",
      properties: {
        subject: {
          type: "string",
          description:
            "Email subject line, 40–60 characters. No clickbait, no exclamation points.",
        },
        previewText: {
          type: "string",
          description:
            "Email preview text (preheader), 60–100 characters. Complements the subject without repeating it.",
        },
        body: {
          type: "string",
          description:
            "Email body, 150–250 words. Leads with audience career context, then the offer, then urgency if applicable.",
        },
        cta: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "Specific action verb. Examples: 'Reserve your seat', 'Watch the replay', 'Download the model', 'Book a 15-minute consultation'. Never 'Learn more'.",
            },
            url: {
              type: "string",
              description: "Optional placeholder URL. Use {{url}} if unknown.",
            },
          },
          required: ["text"],
        },
      },
      required: ["subject", "previewText", "body", "cta"],
    },
    pullQuotes: {
      type: "array",
      description:
        "Exactly 5 quotable lines extracted from the transcript for short-form video clips. Near-verbatim, lightly edited for clarity.",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          quote: {
            type: "string",
            description:
              "1–3 sentences. Near-verbatim from the transcript. Stands alone without context.",
          },
          approxTimestamp: {
            type: "string",
            description:
              "Approximate timestamp in MM:SS format. Estimate from position in the transcript if no timestamps are present.",
          },
        },
        required: ["quote", "approxTimestamp"],
      },
    },
    blogOutline: {
      type: "object",
      description: "One blog post outline based on the webinar's core thesis.",
      properties: {
        title: {
          type: "string",
          description:
            "Blog title that makes a specific claim or creates tension. NOT '5 Things You Need to Know About X'.",
        },
        sections: {
          type: "array",
          description:
            "4–6 sections. First section opens with a concrete scenario. Last section connects briefly to WSP's work without being promotional.",
          minItems: 4,
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              heading: {
                type: "string",
                description: "Section heading in sentence case.",
              },
              bullets: {
                type: "array",
                description: "3–5 bullet points covering the section's key arguments.",
                items: { type: "string" },
                minItems: 1,
              },
            },
            required: ["heading", "bullets"],
          },
        },
      },
      required: ["title", "sections"],
    },
  },
  required: ["linkedinPosts", "email", "pullQuotes", "blogOutline"],
};
