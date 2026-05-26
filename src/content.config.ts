import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tags: z.array(z.string()).default([]),
    excerpt: z.string(),
    featured: z.boolean().default(false),
  }),
});

const replications = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/replications' }),
  schema: z.object({
    title: z.string(),
    paper: z.string().optional(),
    authors: z.array(z.string()).default([]),
    year: z.number().optional(),
    venue: z.string().optional(),
    tldr: z.string().optional(),
    status: z.enum(['complete', 'partial', 'planned']),
    date: z.string(),
    tags: z.array(z.string()).default([]),
    notebook_url: z.string().optional(),
    slides_url: z.string().optional(),
    paper_url: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog, replications };
