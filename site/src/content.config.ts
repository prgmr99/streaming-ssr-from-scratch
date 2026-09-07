import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const chapters = defineCollection({
  loader: glob({
    base: "./src/content/chapters",
    pattern: "**/*.{md,mdx}",
  }),
  schema: z.object({
    /** 장 제목 */
    title: z.string(),
    /** 목차에 쓸 한 줄 요약 */
    summary: z.string(),
    /** 검색 결과에 노출될 설명. 없으면 summary를 쓴다 */
    description: z.string().optional(),
    /** 정렬 순서. 파일명 번호와 맞춘다 */
    order: z.number(),
  }),
});

export const collections = { chapters };
