import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios'; // Make sure to import axios

// A mapping from our app's language names to OneCompiler's language IDs.
const languageMap = {
  python: 'python',
  sql: 'postgresql',
  javascript: 'javascript',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
};

const getLanguageInfo = (question) => {
  if (!question) return { language: 'python', oneCompilerLang: 'python' }; // Default for generic playground
  if (question?.category?.toLowerCase() === 'sql') {
    return { language: 'sql', oneCompilerLang: 'postgresql' };
  }
  const starterLang = question?.starter_codes?.[0]?.language || 'python';
  const oneCompilerLang = languageMap[starterLang] || starterLang;
  return { language: starterLang, oneCompilerLang };
};

const OneCompilerPlayground = ({ question, onSubmissionResult }) => {
  const iframeRef = useRef(null);
  const [currentCode, setCurrentCode] = useState('');
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  const [theme, setTheme] = useState('dark');

  const isPracticeMode = !!question;
  const { language, oneCompilerLang } = getLanguageInfo(question);

  // Build iframe URL with premium features enabled
  const queryParams = new URLSearchParams({
    listenToEvents: 'true',
    codeChangeEvent: 'true',
    theme: theme,
    // Restrict some features only if they are taking a practice test
    ...(isPracticeMode && {
      hideLanguageSelection: 'true',
      hideNew: 'true',
      hideTitle: 'true'
    })
  });

  const iframeSrc = `https://onecompiler.com/embed/${oneCompilerLang}?${queryParams.toString()}`;

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://onecompiler.com') {
        return;
      }

      const data = event.data;

      // Capture code changes from the editor
      if (data.eventType === 'codeChange' && data.files && data.files.length > 0) {
        setCurrentCode(data.files[0].content);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (isPracticeMode && iframeRef.current && isIframeLoaded) {
      const starterCode =
        question.starter_codes?.find((sc) => sc.language === language)?.code ||
        (language === 'sql' ? 'SELECT * FROM your_table;' : '# Write your code here');

      const fileName = language === 'sql' ? 'script.sql' : `main.${oneCompilerLang}`;

      const populate = () => {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            {
              eventType: 'populateCode',
              language: oneCompilerLang,
              files: [
                {
                  name: fileName,
                  content: starterCode,
                },
              ],
            },
            '*'
          );
          setCurrentCode(starterCode);
        }
      };
      populate();
    }
  }, [question, oneCompilerLang, language, isIframeLoaded, isPracticeMode]);

  const handleSubmit = async () => {
    if (!isPracticeMode) return;
    console.log(`Submitting code for question ${question.id}:`, currentCode);

    try {
      const response = await axios.post(`/api/practice/questions/${question.id}/submit`, {
        code: currentCode,
        language: language,
      });
      if (onSubmissionResult) onSubmissionResult(response.data);
    } catch (error) {
      console.error('Submission failed', error);
      if (onSubmissionResult) onSubmissionResult({ status: 'error', message: 'Submission failed' });
    }
  };

  return (
    <div className={`flex flex-col h-full rounded-lg overflow-hidden border shadow-sm ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
      <div className={`p-4 flex justify-between items-center border-b ${theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
        <h2 className="text-xl font-semibold">
          {isPracticeMode ? (question?.title || 'Practice Area') : 'Premium Compiler Playground'}
        </h2>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>

          {isPracticeMode && (
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors"
            >
              Submit Solution
            </button>
          )}
        </div>
      </div>
      <div className="flex-grow relative">
        {!isIframeLoaded && (
          <div className={`absolute inset-0 flex items-center justify-center z-10 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`}>
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-4"></div>
              <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} animate-pulse font-medium`}>
                Loading Premium Compiler...
              </p>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          id="onecompiler-editor-iframe"
          frameBorder="0"
          height="100%"
          width="100%"
          title="OneCompiler Code Editor"
          src={iframeSrc}
          onLoad={() => setIsIframeLoaded(true)}
          style={{ visibility: isIframeLoaded ? 'visible' : 'hidden' }}
          allow="camera; microphone; clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
};

export default OneCompilerPlayground;