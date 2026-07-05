import { useState } from 'react'
import { type Severity } from '../types'

export function useAudioEngine() {
  const [voiceLanguage, setVoiceLanguage] = useState<'en' | 'te' | 'hi'>('en')
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  const announceOutage = (title: string, severity: Severity) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    let text = ''
    if (voiceLanguage === 'en') {
      text = `Attention SRE team. A severity ${severity} outage has been detected. Incident title: ${title}. Correlating microservice event streams.`
    } else if (voiceLanguage === 'te') {
      text = `సవరించండి, తీవ్రత ${severity} లోపం గుర్తించబడింది. సంఘటన శీర్షిక: ${title}. సిస్టమ్ పర్యవేక్షణ ప్రారంభించబడింది.`
    } else if (voiceLanguage === 'hi') {
      text = `कृपया ध्यान दें। स्तर ${severity} की गंभीर खराबी दर्ज की गई है। समस्या का नाम: ${title}. एआई विश्लेषण चालू है।`
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }

  return { voiceLanguage, setVoiceLanguage, voiceEnabled, setVoiceEnabled, announceOutage }
}
