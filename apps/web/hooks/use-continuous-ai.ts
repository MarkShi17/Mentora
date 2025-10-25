'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useSessionStore } from "@/lib/session-store";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (
    (window as unknown as Record<string, SpeechRecognitionConstructor>).SpeechRecognition ??
    (window as unknown as Record<string, SpeechRecognitionConstructor>).webkitSpeechRecognition ??
    null
  );
}

interface ConversationContext {
  recentUtterances: string[];
  topics: string[];
  questions: string[];
  lastActivity: number;
}

interface QuestionDetectionResult {
  isQuestion: boolean;
  confidence: number;
  questionType: 'direct' | 'indirect' | 'clarification' | 'follow-up';
  context: string[];
}

export function useContinuousAI() {
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    recentUtterances: [],
    topics: [],
    questions: [],
    lastActivity: Date.now()
  });
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const contextRef = useRef<ConversationContext>(conversationContext);
  const onQuestionDetectedRef = useRef<((question: string, context: string[]) => void) | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  // Update context ref when conversation context changes
  useEffect(() => {
    contextRef.current = conversationContext;
  }, [conversationContext]);

  const setQuestionCallback = useCallback((callback: (question: string, context: string[]) => void) => {
    onQuestionDetectedRef.current = callback;
  }, []);

  const detectQuestion = useCallback((text: string): QuestionDetectionResult => {
    const utterance = text.toLowerCase().trim();
    
    // Command/request indicators - much more comprehensive
    const commandWords = [
      // Direct commands
      'show me', 'tell me', 'explain', 'help me', 'teach me', 'walk me through',
      'can you', 'could you', 'would you', 'please', 'i need', 'i want',
      
      // Question words
      'what', 'how', 'why', 'when', 'where', 'who', 'which', 'do you', 'are you', 'is it', 'does it',
      
      // Learning requests
      'learn', 'understand', 'know about', 'figure out', 'find out', 'discover',
      
      // Action requests
      'create', 'make', 'build', 'draw', 'write', 'code', 'solve', 'calculate',
      
      // Clarification requests
      'clarify', 'elaborate', 'expand on', 'go deeper', 'more detail', 'i don\'t understand',
      
      // Follow-up requests
      'what about', 'and then', 'next', 'also', 'furthermore', 'additionally', 'what if', 'suppose',
      'continue', 'keep going', 'more', 'another', 'different', 'alternative',
      
      // Direct addressing
      'mentora', 'ai', 'assistant', 'tutor', 'you'
    ];
    
    // Context clues that suggest the user is talking to the AI
    const contextClues = [
      // Technical terms that suggest learning/teaching context
      'algorithm', 'code', 'programming', 'function', 'variable', 'loop', 'recursion',
      'data structure', 'array', 'list', 'tree', 'graph', 'sorting', 'searching',
      'math', 'equation', 'formula', 'calculation', 'problem', 'solution',
      'concept', 'theory', 'principle', 'method', 'approach', 'technique',
      
      // Learning context
      'learn', 'study', 'practice', 'example', 'tutorial', 'lesson', 'course',
      'homework', 'assignment', 'project', 'exercise', 'problem set',
      
      // Question context
      'question', 'ask', 'wonder', 'curious', 'confused', 'stuck', 'difficult'
    ];

    let isQuestion = false;
    let confidence = 0;
    let questionType: QuestionDetectionResult['questionType'] = 'direct';
    let context: string[] = [];

    // Check for explicit commands/requests
    const hasCommand = commandWords.some(word => utterance.includes(word));
    const hasContextClue = contextClues.some(clue => utterance.includes(clue));
    const hasQuestionMark = utterance.includes('?');
    
    // Calculate confidence based on multiple factors
    if (hasCommand) {
      confidence += 0.6;
      isQuestion = true;
    }
    
    if (hasContextClue) {
      confidence += 0.3;
    }
    
    if (hasQuestionMark) {
      confidence += 0.2;
    }
    
    // Check for direct addressing (mentora, ai, etc.)
    if (utterance.includes('mentora') || utterance.includes('ai') || utterance.includes('assistant') || utterance.includes('tutor')) {
      confidence += 0.4;
      isQuestion = true;
    }
    
    // Check for imperative mood (commands without question words)
    const imperativePatterns = [
      /^(show|tell|explain|help|teach|create|make|build|draw|write|code|solve|calculate)/,
      /^(i need|i want|i\'d like|can you|could you|would you)/
    ];
    
    if (imperativePatterns.some(pattern => pattern.test(utterance))) {
      confidence += 0.5;
      isQuestion = true;
    }
    
    // Check for incomplete thoughts that might be questions
    if (utterance.length > 10 && (utterance.endsWith('...') || utterance.includes('um') || utterance.includes('uh'))) {
      confidence += 0.2;
    }
    
    // Determine question type
    if (hasQuestionMark || utterance.startsWith('what') || utterance.startsWith('how') || utterance.startsWith('why')) {
      questionType = 'direct';
    } else if (utterance.includes('show me') || utterance.includes('tell me') || utterance.includes('explain')) {
      questionType = 'indirect';
    } else if (utterance.includes('clarify') || utterance.includes('don\'t understand') || utterance.includes('confused')) {
      questionType = 'clarification';
    } else if (utterance.includes('what about') || utterance.includes('and then') || utterance.includes('next')) {
      questionType = 'follow-up';
    } else {
      questionType = 'indirect'; // Default for commands
    }

    // Build context from recent conversation
    if (isQuestion && confidence > 0.5) {
      const recentContext = contextRef.current.recentUtterances.slice(-3); // Last 3 utterances
      const topicContext = contextRef.current.topics.slice(-2); // Last 2 topics
      context = [...recentContext, ...topicContext].filter(Boolean);
    }

    return { isQuestion, confidence, questionType, context };
  }, []);

  const isEducationalCommand = useCallback((text: string): boolean => {
    const lowerText = text.toLowerCase();
    
    // First, check for inappropriate/nonsensical requests that should be filtered out
    const inappropriatePatterns = [
      // Commands that don't make sense for an AI tutor
      'play music', 'play song', 'sing', 'dance', 'joke', 'tell joke', 'be funny',
      'order food', 'order pizza', 'buy', 'purchase', 'shop', 'shopping',
      'call', 'phone', 'text', 'message', 'email', 'send email',
      'book', 'reserve', 'schedule appointment', 'make reservation',
      'turn on', 'turn off', 'switch', 'toggle', 'control', 'remote',
      'open app', 'launch', 'start game', 'play game', 'gaming',
      'social media', 'facebook', 'twitter', 'instagram', 'tiktok',
      'entertainment', 'movie', 'tv show', 'netflix', 'youtube video',
      'personal', 'private', 'secret', 'confidential', 'relationship',
      'medical', 'health advice', 'diagnosis', 'treatment', 'medicine',
      'legal advice', 'lawyer', 'court', 'lawsuit', 'legal',
      'financial advice', 'investment', 'stock', 'money', 'banking',
      'religious', 'spiritual', 'prayer', 'god', 'faith',
      'political', 'election', 'vote', 'candidate', 'party',
      'inappropriate', 'adult', 'nsfw', 'explicit'
    ];
    
    // Check if the request is inappropriate
    const isInappropriate = inappropriatePatterns.some(pattern => lowerText.includes(pattern));
    if (isInappropriate) {
      return false;
    }
    
    // Educational/informational keywords - much more inclusive
    const educationalKeywords = [
      // Learning actions
      'learn', 'study', 'teach', 'explain', 'understand', 'practice', 'tutorial', 'lesson',
      'course', 'education', 'academic', 'school', 'university', 'college', 'homework',
      'assignment', 'project', 'exercise', 'problem', 'solution', 'example',
      
      // Technical subjects
      'algorithm', 'data structure', 'recursion', 'sorting', 'searching', 'binary search',
      'tree', 'graph', 'linked list', 'array', 'stack', 'queue', 'hash table',
      'programming', 'coding', 'javascript', 'python', 'java', 'typescript', 'c++', 'c#',
      'react', 'node', 'database', 'sql', 'api', 'frontend', 'backend', 'web development',
      'machine learning', 'ai', 'neural network', 'deep learning', 'data science',
      'mathematics', 'math', 'calculus', 'algebra', 'statistics', 'probability', 'geometry',
      'physics', 'chemistry', 'biology', 'science', 'engineering', 'computer science',
      
      // Academic concepts
      'concept', 'theory', 'principle', 'method', 'approach', 'technique', 'strategy',
      'analysis', 'synthesis', 'evaluation', 'research', 'hypothesis', 'experiment',
      'formula', 'equation', 'calculation', 'computation', 'logic', 'reasoning',
      
      // Informational topics (expanded)
      'weather', 'climate', 'temperature', 'forecast', 'rain', 'sunny', 'cloudy',
      'history', 'historical', 'timeline', 'events', 'dates', 'century', 'era',
      'geography', 'countries', 'cities', 'capitals', 'continents', 'oceans',
      'culture', 'traditions', 'customs', 'languages', 'religions', 'festivals',
      'economics', 'business', 'market', 'trade', 'economy', 'finance',
      'literature', 'books', 'authors', 'poetry', 'novels', 'writing',
      'art', 'painting', 'sculpture', 'music', 'composers', 'artists',
      'philosophy', 'ethics', 'morality', 'thinking', 'ideas', 'beliefs',
      'psychology', 'behavior', 'mind', 'emotions', 'personality',
      'sociology', 'society', 'community', 'social', 'groups',
      'anthropology', 'human', 'evolution', 'civilization',
      'astronomy', 'space', 'planets', 'stars', 'universe', 'galaxy',
      'geology', 'rocks', 'minerals', 'earth', 'volcanoes', 'earthquakes',
      'botany', 'plants', 'trees', 'flowers', 'gardening', 'agriculture',
      'zoology', 'animals', 'wildlife', 'pets', 'biology',
      'nutrition', 'food', 'cooking', 'recipes', 'health', 'diet',
      'sports', 'fitness', 'exercise', 'training', 'athletics',
      'technology', 'innovation', 'invention', 'devices', 'gadgets',
      'environment', 'ecology', 'sustainability', 'conservation',
      'current events', 'news', 'politics', 'government', 'policy',
      'travel', 'tourism', 'destinations', 'vacation', 'places',
      'careers', 'jobs', 'professions', 'skills', 'resume',
      'languages', 'translation', 'grammar', 'vocabulary', 'communication'
    ];
    
    // Check if the text contains educational/informational keywords
    const hasEducationalContent = educationalKeywords.some(keyword => lowerText.includes(keyword));
    
    // Check for informational question patterns
    const informationalPatterns = [
      'what is', 'how does', 'why does', 'when do', 'where is', 'which is',
      'can you explain', 'could you show', 'would you teach', 'help me understand',
      'i need to learn', 'i want to know', 'i don\'t understand', 'i\'m confused',
      'tell me about', 'show me', 'describe', 'define', 'what about',
      'how do', 'why is', 'when is', 'where are', 'who is', 'what are',
      'can you tell me', 'could you explain', 'would you describe',
      'i\'m curious about', 'i wonder', 'i\'m interested in'
    ];
    
    const hasInformationalPattern = informationalPatterns.some(pattern => lowerText.includes(pattern));
    
    // Check for direct educational commands
    const educationalCommands = [
      'show me how', 'teach me', 'explain to me', 'help me learn', 'walk me through',
      'demonstrate', 'illustrate', 'clarify', 'elaborate on', 'break down',
      'step by step', 'in detail', 'with examples', 'for beginners'
    ];
    
    const hasEducationalCommand = educationalCommands.some(command => lowerText.includes(command));
    
    // Direct addressing to AI/tutor
    const directAddressing = ['mentora', 'tutor', 'teacher', 'instructor', 'professor', 'educator', 'ai', 'assistant'];
    const hasDirectAddressing = directAddressing.some(address => lowerText.includes(address));
    
    // Allow if it has educational content, informational patterns, educational commands, or direct addressing
    return hasEducationalContent || hasInformationalPattern || hasEducationalCommand || hasDirectAddressing;
  }, []);

  const cleanQuestion = useCallback((text: string): string => {
    let cleaned = text.trim();
    
    // Remove common filler words and addressing
    const removePatterns = [
      /^(mentora|ai|assistant|tutor|teacher|hey|hi|hello|okay|ok|so|well|um|uh|like|you know|i mean)\s*,?\s*/i,
      /^(can you|could you|would you|please)\s+/i,
      /^(tell me|show me|explain to me|help me)\s+/i,
      /\s+(please|thanks|thank you|okay|ok)\s*$/i,
      /\s+(um|uh|like|you know|i mean)\s+/gi
    ];
    
    removePatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, ' ').trim();
    });
    
    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Ensure it ends with proper punctuation
    if (cleaned.length > 0 && !cleaned.match(/[.!?]$/)) {
      // If it starts with a question word, add question mark
      if (cleaned.match(/^(what|how|why|when|where|who|which|can|could|would|do|are|is|does)/i)) {
        cleaned += '?';
      } else {
        cleaned += '.';
      }
    }
    
    return cleaned;
  }, []);

  const extractTopics = useCallback((text: string): string[] => {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Technical topics
    const technicalTerms = [
      'algorithm', 'data structure', 'recursion', 'sorting', 'searching', 'binary search',
      'tree', 'graph', 'linked list', 'array', 'stack', 'queue', 'hash table',
      'programming', 'coding', 'javascript', 'python', 'java', 'typescript',
      'react', 'node', 'database', 'sql', 'api', 'frontend', 'backend',
      'machine learning', 'ai', 'neural network', 'deep learning',
      'mathematics', 'calculus', 'algebra', 'statistics', 'probability',
      'physics', 'chemistry', 'biology', 'science'
    ];

    technicalTerms.forEach(term => {
      if (lowerText.includes(term)) {
        topics.push(term);
      }
    });

    return topics;
  }, []);

  const updateContext = useCallback((utterance: string) => {
    setConversationContext(prev => {
      const newContext = {
        ...prev,
        recentUtterances: [...prev.recentUtterances.slice(-4), utterance].filter(Boolean), // Keep last 5
        topics: [...new Set([...prev.topics, ...extractTopics(utterance)])].slice(-10), // Keep last 10 unique topics
        lastActivity: Date.now()
      };
      return newContext;
    });
  }, [extractTopics]);

  const createRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSupported(false);
      setError("Speech recognition not supported in this browser.");
      return null;
    }
    
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Always listening
      recognition.interimResults = true; // Get real-time results
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;
      
      setSupported(true);
      return recognition;
    } catch (error) {
      console.error("Failed to create speech recognition:", error);
      setSupported(false);
      setError("Failed to initialize speech recognition.");
      return null;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (isListening || isProcessingRef.current) return;
    
    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setError("Microphone permission denied. Please allow microphone access and try again.");
      return;
    }
    
    const recognition = createRecognition();
    if (!recognition) return;
    
    recognitionRef.current = recognition;
    setIsListening(true);
    setError(null);
    setSupported(true);

    let currentInterimText = "";
    let lastFinalText = "";

    const handleResult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim();
      const isFinal = result.isFinal;
      
      if (isFinal && transcript) {
        // Process final result
        console.log('Final utterance:', transcript);
        
        // Reset processing flag for new utterance
        isProcessingRef.current = false;
        
        // Update context with the utterance
        updateContext(transcript);
        
        // Detect if this is a question
        const questionResult = detectQuestion(transcript);
        const isEducational = isEducationalCommand(transcript);
        console.log('Analyzing utterance:', transcript, 'Confidence:', questionResult.confidence, 'IsQuestion:', questionResult.isQuestion, 'IsEducational:', isEducational);
        
        if (questionResult.isQuestion && questionResult.confidence > 0.4 && isEducational) {
          console.log('Question detected:', transcript, 'Type:', questionResult.questionType, 'Confidence:', questionResult.confidence);
          
          // Prevent multiple processing of the same question
          if (transcript !== lastFinalText && !isProcessingRef.current) {
            isProcessingRef.current = true;
            lastFinalText = transcript;
            
            // Clear any existing timeout
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
            }
            
            // Set a timeout to process the question after a brief silence
            silenceTimeoutRef.current = setTimeout(() => {
              if (onQuestionDetectedRef.current) {
                // Clean up the question to extract just the question part
                const cleanedQuestion = cleanQuestion(transcript);
                console.log('Processing question with context:', cleanedQuestion, questionResult.context);
                onQuestionDetectedRef.current(cleanedQuestion, questionResult.context);
              }
              // Don't set isProcessingRef.current = false here - keep listening
              // The processing will be reset when the next utterance comes in
            }, 2000); // 2 second delay to ensure complete utterance
          }
        }
        
        setCurrentTranscript("");
        currentInterimText = "";
      } else if (transcript) {
        // Update interim results
        currentInterimText = transcript;
        setCurrentTranscript(transcript);
      }
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      
      let errorMessage = event.error;
      if (event.error === 'not-allowed') {
        errorMessage = "Microphone permission denied. Please allow microphone access.";
      } else if (event.error === 'no-speech') {
        // Don't treat no-speech as an error in continuous mode
        return;
      } else if (event.error === 'network') {
        errorMessage = "Network error. Please check your connection.";
      }
      
      setError(errorMessage);
      setIsListening(false);
      recognitionRef.current = null;
    };

    const handleEnd = () => {
      console.log("Speech recognition ended, restarting...");
      // In continuous mode, restart automatically
      if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error("Failed to restart recognition:", error);
          setIsListening(false);
          recognitionRef.current = null;
        }
      }
    };

    recognition.addEventListener("result", handleResult);
    recognition.addEventListener("error", handleError);
    recognition.addEventListener("end", handleEnd);

    try {
      recognition.start();
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
      setError("Failed to start speech recognition");
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [isListening, createRecognition, updateContext, detectQuestion]);

  const forceProcessTranscript = useCallback(() => {
    const transcript = currentTranscript.trim();

    if (!transcript) {
      console.log('⚠️ No transcript to process');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚡ FORCE PROCESSING TRANSCRIPT (Push-to-talk released)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Transcript:', transcript);

    // Update context with the utterance
    updateContext(transcript);

    // Detect if this is a question
    const questionResult = detectQuestion(transcript);
    const isEducational = isEducationalCommand(transcript);

    console.log('Force analysis:', {
      transcript,
      confidence: questionResult.confidence,
      isQuestion: questionResult.isQuestion,
      isEducational
    });

    if ((questionResult.isQuestion || questionResult.confidence > 0.3) && isEducational) {
      console.log('✅ Forcing question processing');

      if (onQuestionDetectedRef.current) {
        const cleanedQuestion = cleanQuestion(transcript);
        console.log('Processing forced question:', cleanedQuestion, questionResult.context);
        onQuestionDetectedRef.current(cleanedQuestion, questionResult.context);
      }
    } else {
      console.log('❌ Transcript did not qualify as question');
    }

    // Reset transcript
    setCurrentTranscript("");
  }, [currentTranscript, updateContext, detectQuestion, isEducationalCommand, cleanQuestion]);

  const stopListening = useCallback(() => {
    if (!isListening || !recognitionRef.current) return;

    // Force process any pending transcript before stopping
    forceProcessTranscript();

    // Clear any pending timeouts
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error("Failed to stop speech recognition:", error);
    }
    setIsListening(false);
    recognitionRef.current = null;
    isProcessingRef.current = false;
  }, [isListening, forceProcessTranscript]);

  const pauseListening = useCallback(() => {
    if (!isListening || !recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
      setIsListening(false);
      // Keep recognitionRef so we can resume
    } catch (error) {
      console.error("Failed to pause speech recognition:", error);
    }
  }, [isListening]);

  const resumeListening = useCallback(() => {
    if (isListening || !recognitionRef.current) return;

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error("Failed to resume speech recognition:", error);
      // If resume fails, restart completely
      startListening();
    }
  }, [isListening, startListening]);

  // Initialize support check
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      setSupported(true);
      setError(null);
    } else {
      setSupported(false);
      setError("Speech recognition not supported in this browser.");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    isListening,
    currentTranscript,
    conversationContext,
    supported,
    error,
    startListening,
    stopListening,
    pauseListening,
    resumeListening,
    setQuestionCallback,
    forceProcessTranscript
  };
}
