// Voice Recognition Functions
let voiceRecognition = null;

function initializeVoiceRecognition() {
    if ('webkitSpeechRecognition' in window) {
        voiceRecognition = new webkitSpeechRecognition();
        voiceRecognition.continuous = true;
        voiceRecognition.interimResults = true;
        voiceRecognition.lang = 'en-US';
        
        voiceRecognition.onresult = function(event) {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                const textarea = document.getElementById('justificationText');
                textarea.value += (textarea.value ? ' ' : '') + finalTranscript;
                updateWordCount();
            }
        };

        voiceRecognition.onerror = function(event) {
            console.error('Voice recognition error:', event.error);
            const btn = document.getElementById('voiceBtn');
            if (btn) {
                btn.classList.remove('active');
                btn.textContent = '🎤 Voice Input';
            }
        };
    }
}

function toggleVoiceInput() {
    const btn = document.getElementById('voiceBtn');
    if (!voiceRecognition) {
        alert('Voice recognition not supported in this browser');
        return;
    }
    
    if (btn.classList.contains('active')) {
        voiceRecognition.stop();
        btn.classList.remove('active');
        btn.textContent = '🎤 Voice Input';
    } else {
        voiceRecognition.start();
        btn.classList.add('active');
        btn.textContent = '🔴 Recording...';
    }
}