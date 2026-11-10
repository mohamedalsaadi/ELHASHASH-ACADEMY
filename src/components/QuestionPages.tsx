/** The picture or PDF pages of a question, served by /api/question-media (which checks who may see them). */
export function QuestionPages({ itemId, count, label }: { itemId: string; count: number; label: string }) {
  if (count === 0) return null;
  return (
    <div className="grid gap-2">
      {Array.from({ length: count }, (_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`/api/question-media/${itemId}/${i}`} alt={`${label} ${i + 1}`} loading="lazy" className="w-full rounded-md border border-hairline bg-white" />
      ))}
    </div>
  );
}
