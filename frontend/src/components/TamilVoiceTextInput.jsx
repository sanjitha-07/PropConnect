import { useState, useEffect, useRef } from "react";

// Common authentic Tamil phrases for tenant maintenance, complaints, and home repairs
const TAMIL_QUICK_PHRASES = [
  { label: "🚰 குழாய் கசிவு", text: "குளியலறை குழாயில் தண்ணீர் கசிகிறது, உடனடியாக பழுதுபார்க்கவும்." },
  { label: "⚡ மின்சார பிரச்சனை", text: "சுவிட்ச் போர்டு மற்றும் MCB அடிக்கடி ட்ரிப் ஆகிறது, மின்சார பழுது உள்ளது." },
  { label: "🧱 சிவில் வேலை / விரிசல்", text: "சுவரில் விரிசல் மற்றும் டைல்ஸ் பெயர்ந்துள்ளது, சிவில் கொத்தனார் வேலை தேவை." },
  { label: "❄️ ஏசி வேலை செய்யவில்லை", text: "ஏசி இயந்திரத்தில் குளிர்ச்சி காற்று வரவில்லை, சர்வீஸ் செய்ய வேண்டும்." },
  { label: "🚪 கதவு பூட்டு பழுது", text: "பிரதான கதவு பூட்டு மற்றும் கைப்பிடி சரியாக மூடவில்லை, தச்சர் வேலை தேவை." },
  { label: "✨ ஆழமான சுத்தம்", text: "வீடு மற்றும் கழிவறை முழுமையாக ஆழமாக சுத்தம் செய்து தர வேண்டும்." },
  { label: "💧 கழிவுநீர் அடைப்பு", text: "வாஷ்பேசின் மற்றும் வடிகால் குழாயில் அடைப்பு ஏற்பட்டுள்ளது." },
  { label: "🎨 பெயிண்டிங் / ஈரம்", text: "சுவரில் நீர் கசிவு மற்றும் பூஞ்சை ஏற்பட்டுள்ளது, வாட்டர்ப்ரூஃபிங் தேவை." },
];

// Tamil vowels and frequent consonants for quick virtual touch typing
const TAMIL_KEYS = [
  "அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ",
  "க", "ங", "ச", "ஞ", "ட", "ண", "த", "ந", "ப", "ம", "ய", "ர", "ல", "வ", "ழ", "ள", "ற", "ன",
  "்", "ா", "ி", "ீ", "ு", "ூ", "ெ", "ே", "ை", "ொ", "ோ", "ௌ"
];

export default function TamilVoiceTextInput({
  value = "",
  onChange,
  placeholder = "Describe your issue or service request in Tamil or English… (தமிழிலும் தட்டச்சு செய்யலாம்)",
  rows = 3,
  label = "Complaint Description / விவரம்",
  required = false,
  showTamilKeyboardDefault = false,
}) {
  const [isListening, setIsListening] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState("ta-IN"); // 'ta-IN' for Tamil, 'en-IN' for Indian English
  const [showTamilTools, setShowTamilTools] = useState(showTamilKeyboardDefault);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [statusNotice, setStatusNotice] = useState("");

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLanguage;

      recognition.onstart = () => {
        setIsListening(true);
        setStatusNotice(
          speechLanguage === "ta-IN"
            ? "🎙️ தமிழில் பேசுங்கள்... (Listening in Tamil...)"
            : "🎙️ Listening to English speech..."
        );
      };

      recognition.onresult = (event) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            currentTranscript += event.results[i][0].transcript + " ";
          }
        }
        if (currentTranscript.trim()) {
          const updated = value ? `${value.trim()} ${currentTranscript.trim()}` : currentTranscript.trim();
          onChange(updated);
        }
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition notice:", e.error);
        setIsListening(false);
        if (e.error === "not-allowed") {
          setStatusNotice("Microphone permission denied. Please allow microphone in browser.");
        } else {
          setStatusNotice(`Voice recognition paused (${e.error}).`);
        }
        setTimeout(() => setStatusNotice(""), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [speechLanguage, value, onChange]);

  const toggleListening = () => {
    if (!speechSupported) {
      setStatusNotice("Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.");
      setTimeout(() => setStatusNotice(""), 4000);
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      setStatusNotice("");
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = speechLanguage;
          recognitionRef.current.start();
        }
      } catch (err) {
        console.warn("Could not start recognition:", err);
      }
    }
  };

  const handleInsertPhrase = (phraseText) => {
    const updated = value ? `${value.trim()} ${phraseText}` : phraseText;
    onChange(updated);
  };

  const handleInsertKey = (keyChar) => {
    onChange((value || "") + keyChar);
  };

  return (
    <div className="tamil-voice-input-container" style={{ margin: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "8px" }}>
        <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: "13px" }}>
          {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Language Toggle: Tamil / English */}
          <select
            value={speechLanguage}
            onChange={(e) => setSpeechLanguage(e.target.value)}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border-subtle, #cbd5e1)",
              fontSize: "12px",
              background: "#ffffff",
              color: "#334155",
              cursor: "pointer",
            }}
            title="Select speech recognition language"
          >
            <option value="ta-IN">தமிழ் (Tamil)</option>
            <option value="en-IN">English (India)</option>
          </select>

          {/* Voice to text trigger button */}
          <button
            type="button"
            onClick={toggleListening}
            className={`btn-outline ${isListening ? "active" : ""}`}
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              fontWeight: 700,
              borderRadius: "20px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              border: isListening ? "1px solid #ef4444" : "1px solid #0284c7",
              background: isListening ? "#fef2f2" : "#f0f9ff",
              color: isListening ? "#dc2626" : "#0284c7",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            <span style={{ fontSize: "14px", animation: isListening ? "pulse 1.2s infinite" : "none" }}>
              {isListening ? "🔴" : "🎙️"}
            </span>
            <span>{isListening ? "Stop Voice Recording" : "Voice to Text"}</span>
          </button>

          {/* Tamil virtual assistant toggle */}
          <button
            type="button"
            onClick={() => setShowTamilTools((prev) => !prev)}
            style={{
              padding: "5px 10px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "6px",
              border: "1px solid var(--border-subtle, #e2e8f0)",
              background: showTamilTools ? "#e0f2fe" : "#ffffff",
              color: showTamilTools ? "#0369a1" : "#475569",
              cursor: "pointer",
            }}
            title="Toggle Tamil virtual typing keyboard and instant complaint phrases"
          >
            ⌨️ தமிழ் உதவி {showTamilTools ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {/* Voice status banner */}
      {statusNotice && (
        <div
          style={{
            padding: "6px 12px",
            background: isListening ? "#eff6ff" : "#f8fafc",
            border: isListening ? "1px solid #93c5fd" : "1px solid #cbd5e1",
            borderRadius: "6px",
            fontSize: "12px",
            color: isListening ? "#1d4ed8" : "#475569",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Main Textarea */}
      <textarea
        className="form-input"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: "13.5px",
          lineHeight: "1.5",
          borderRadius: "8px",
          border: isListening ? "2px solid #38bdf8" : "1px solid var(--border-subtle, #cbd5e1)",
          boxShadow: isListening ? "0 0 0 3px rgba(56, 189, 248, 0.2)" : "none",
          transition: "border 0.2s, box-shadow 0.2s",
        }}
      />

      {/* Tamil Assistant Panel (Phrases & Virtual Keyboard) */}
      {showTamilTools && (
        <div
          style={{
            marginTop: "10px",
            padding: "12px",
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          {/* Quick Phrases */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
              ⚡常用 பொதுவான புகார்கள் (Click to insert instant Tamil complaint):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {TAMIL_QUICK_PHRASES.map((item, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleInsertPhrase(item.text)}
                  style={{
                    padding: "4px 9px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    fontSize: "11.5px",
                    color: "#0f172a",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#0284c7";
                    e.currentTarget.style.background = "#f0f9ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.background = "#ffffff";
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Virtual Tamil Keyboard */}
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
              ⌨️ தமிழ் எழுத்து பலகை (Virtual Tamil Touch Keys):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {TAMIL_KEYS.map((char, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleInsertKey(char)}
                  style={{
                    width: "28px",
                    height: "28px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "4px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1e293b",
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#0284c7";
                    e.currentTarget.style.background = "#e0f2fe";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.background = "#ffffff";
                  }}
                >
                  {char}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleInsertKey(" ")}
                style={{
                  padding: "0 10px",
                  height: "28px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                Space (இடைவெளி)
              </button>
              <button
                type="button"
                onClick={() => onChange(value.slice(0, -1))}
                style={{
                  padding: "0 8px",
                  height: "28px",
                  background: "#fee2e2",
                  border: "1px solid #fca5a5",
                  borderRadius: "4px",
                  fontSize: "11.5px",
                  fontWeight: 600,
                  color: "#991b1b",
                  cursor: "pointer",
                }}
                title="Backspace / Delete last character"
              >
                ⌫ அழி
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
