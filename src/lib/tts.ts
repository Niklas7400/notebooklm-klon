const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Zwei unterschiedliche Stimmen fuer die zwei Podcast-Hosts (siehe CLAUDE.md).
// Chirp3-HD statt WaveNet (nachtraeglich gewechselt): WaveNet spricht englische
// Fachbegriffe im sonst deutschen Skript (RAG, Embedding, Voice AI Agents, ...)
// mit deutscher Phonetik aus. Chirp3-HD (Gemini-basiertes TTS-Modell) handhabt
// eingebettete Fremdwoerter laut Google-Doku deutlich robuster. Live gegen die
// echte API getestet (siehe Commit) -- falls das nicht ausreicht, naechster
// Schritt waere SSML mit expliziten <lang>-Tags um englische Begriffe.
const VOICE_BY_SPEAKER: Record<"A" | "B", string> = {
  A: "de-DE-Chirp3-HD-Kore",
  B: "de-DE-Chirp3-HD-Charon",
};

export async function synthesizeSpeech(text: string, speaker: "A" | "B"): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  const res = await fetch(`${TTS_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "de-DE", name: VOICE_BY_SPEAKER[speaker] },
      // headphone-class-device: Googles eigenes Post-Processing-Profil,
      // abgestimmt auf Kopfhoerer-/Laptop-Lautsprecher-Wiedergabe -- der
      // realistische Hoerkontext fuer einen Reviewer. Live getestet, mit
      // Chirp3-HD kompatibel (anders als z.B. "pitch", das dieses Voice-
      // Modell nicht unterstuetzt).
      audioConfig: { audioEncoding: "MP3", effectsProfileId: ["headphone-class-device"] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS-Request fehlgeschlagen (${res.status}): ${body}`);
  }

  const json = await res.json();
  return Buffer.from(json.audioContent as string, "base64");
}
