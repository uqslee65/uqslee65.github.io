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
    paper: z.string(),
    status: z.enum(['complete', 'partial', 'planned']),
    date: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog, replications };
