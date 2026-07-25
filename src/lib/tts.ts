const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Zwei unterschiedliche Stimmen fuer die zwei Podcast-Hosts (siehe CLAUDE.md).
const VOICE_BY_SPEAKER: Record<"A" | "B", string> = {
  A: "de-DE-Wavenet-F",
  B: "de-DE-Wavenet-B",
};

export async function synthesizeSpeech(text: string, speaker: "A" | "B"): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  const res = await fetch(`${TTS_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "de-DE", name: VOICE_BY_SPEAKER[speaker] },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`TTS-Request fehlgeschlagen (${res.status}): ${body}`);
  }

  const json = await res.json();
  return Buffer.from(json.audioContent as string, "base64");
}
