/** Pure announcer logic: which recorded clip to play for a line, and what
 *  (if anything) the synthesised voice still has to say. No Audio here, so it
 *  runs under Vitest in node. */

export interface AnnounceRequest {
  /** Clip key: 'fight', 'win', 'perfect', 'timeout', 'ko', 'round', ... */
  key: string;
  /** Round number, for key 'round'. Looks up clip 'round<N>', then 'round'. */
  round?: number;
  /** Fish name, spoken by synthesis after a recorded round clip when
   *  speakFishName is on. */
  fish?: string;
}

export interface AnnouncePlan {
  /** Clip path (relative to public/) to play, or null for speech only. */
  clip: string | null;
  /** Spoken line to say after the clip (or instead of it); null for nothing. */
  speech: string | null;
}

export function planAnnounce(
  req: AnnounceRequest | undefined,
  text: string,
  clips: Record<string, string>,
  speakFishName: boolean,
): AnnouncePlan {
  if (!req) return { clip: null, speech: text };
  const clip = (req.round !== undefined ? clips[`${req.key}${req.round}`] : undefined) ?? clips[req.key] ?? null;
  if (!clip) return { clip: null, speech: text };
  const speech = req.key === 'round' && speakFishName && req.fish ? req.fish : null;
  return { clip, speech };
}
