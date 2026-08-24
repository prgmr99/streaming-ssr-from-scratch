import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * 각 장을 하나의 MDX 파일로 관리한다.
 * 파일명 앞의 번호가 순서를 결정한다. (01-, 02-, ...)
 */
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
    /** 정렬 순서. 파일명 번호와 맞춘다 */
    order: z.number(),
  }),
});

export const collections = { chapters };
