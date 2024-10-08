import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './chat-page.css';
import storeConvo from '../../pages/database-example/db-store-conversation';
import getConvo from '../../pages/database-example/db-get-conversation';
import storeChat from '../../pages/database-example/db-store-chat';
import storeFlashcard from '../../pages/database-example/db-store-flashcard';
import NavigationBar from '../../components/NavigationBar/NavigationBar';
import { fetchFlashcardSets } from '../../components/utils';

function ChatBot({ chat, user, convo_id }) {
  const [inputValue, setInputValue] = useState('');
  const [promptResponses, setPromptResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queryResponse, setQueryResponse] = useState({});
  const [isEditingFlashcard, setIsEditingFlashcard] = useState(false);
  const [flashcardFront, setFlashcardFront] = useState('');
  const [flashcardBack, setFlashcardBack] = useState('');
  const [flashcardSets, setFlashcardSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(''); // Track the selected set

  // Reference to the chat window for auto-scrolling
  const chatWindowRef = useRef(null);

  // Fetch flashcard sets when component mounts
  useEffect(() => {
    const loadFlashcardSets = async () => {
      const sets = await fetchFlashcardSets(user); // Fetch sets from Supabase
      setFlashcardSets(sets); // Store the sets in state
    };

    loadFlashcardSets(); // Call the function
  }, [user]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      getResponseForGivenPrompt();
    }
  };

  // Storing chat history
  const previousPromptResponses = useRef(promptResponses);
  useEffect(() => {
    if (previousPromptResponses.current !== promptResponses) {
      storeConvo(convo_id, promptResponses);
      previousPromptResponses.current = promptResponses;
    }
  }, [promptResponses, convo_id]);

  // Retrieve conversations by convo_id to restore chat state after switching tabs
  useEffect(() => {
    const fetchConversation = async () => {
      const fetchedConversation = await getConvo(convo_id);

      if (fetchedConversation != null) {
        setPromptResponses(fetchedConversation);
      }
    };

    fetchConversation();
  }, [convo_id]);

  // Auto-scroll to bottom when promptResponses change
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [promptResponses]);

  // Create flashcard by querying GPT to summarize to two sentences
  const addFlashcard = async () => {
    if (!queryResponse.query?.trim() || !queryResponse.response?.trim()) return;

    try {
      const userQuery = `
        Can you make one flashcard out of this query and response pair? 
        It should be less than two sentences without formatting. 
        Query: ${queryResponse.query} 
        $$$ Response: ${queryResponse.response}. 
        Put $$$ in your response between the flashcard front (a question) and back (an answer).
      `;

      setLoading(true);

      const result = await chat.sendMessage(userQuery);
      const generatedFlashcard = result.response.text();
      setLoading(false);

      const [front, back] = generatedFlashcard.split('$$$');

      // If the flashcard format is correct
      if (front && back) {
        setFlashcardFront(front.trim());
        setFlashcardBack(back.trim());
        setIsEditingFlashcard(true); // Show the editing panel
      } else {
        console.log('Error: Flashcard format is incorrect.');
      }
    } catch (error) {
      console.log('Error while generating flashcard:', error);
      setLoading(false);
    }
  };

  const submitFlashcard = async () => {
    try {
      console.log('SELECTED', selectedSet);
      const userId = user?.id;
      await storeFlashcard(
        flashcardFront.trim(),
        flashcardBack.trim(),
        userId,
        selectedSet
      );
      setIsEditingFlashcard(false); // Close the editing panel
      setFlashcardFront('');
      setFlashcardBack('');
      console.log('Flashcard successfully saved to Supabase');
    } catch (error) {
      console.error('Error saving flashcard to Supabase:', error);
    }
  };

  const getResponseForGivenPrompt = async () => {
    if (!inputValue.trim()) return;

    try {
      const userQuery = inputValue;
      setLoading(true);
      // Append user's query to promptResponses
      setPromptResponses((prevResponses) => [
        ...prevResponses,
        { text: userQuery, isUser: true },
      ]);
      setInputValue('');
      const result = await chat.sendMessage(userQuery);
      const response = result.response.text();

      // Append Gemini's response
      setPromptResponses((prevResponses) => [
        ...prevResponses,
        { text: response, isUser: false },
      ]);
      setQueryResponse({ query: userQuery, response: response });

      setLoading(false);

      const category = await getCategory(userQuery);
      const userId = user?.id;
      const isFlashcard = false;

      await storeChat(userQuery, response, category, userId, isFlashcard);
    } catch (error) {
      console.log('Something Went Wrong');
      setLoading(false);
    }
  };

  const getCategory = async (userQuery) => {
    try {
      // Call the Gemini API
      const apiKeyGemini = process.env.REACT_APP_GEMINI_API_KEY;
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(apiKeyGemini);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const userQuery2 =
        'Here is my user query: ' +
        userQuery +
        '. If academically related, please provide me with the subject in one word only. Some examples include Computer Science, Math, Biology, Physics, History, Language, Music, Business, etc. If not academically related, please output the label "Other". Do not provide any other information.';
      const result = await model.generateContent(userQuery2);
      const response = result.response;
      const category = response.text();
      return category;
    } catch (error) {
      console.log(error);
      console.log('Something Went Wrong');
      setLoading(false);
      return null;
    }
  };

  return (
    <div className="flex bg-gradient-to-br from-[#1e1e1e] to-[#333333]">
      <NavigationBar />
      <div className="chat-container">
        {/* Conditionally render the greeting based on prompt responses */}
        {promptResponses.length === 0 && (
          <div className="greeting-container">
            <h1 className="greeting-text">Hello, {user?.email || 'Guest'}</h1>
            <p className="greeting-subtext">How can I help you today?</p>
          </div>
        )}

        <div className="chat-window" ref={chatWindowRef}>
          {promptResponses?.map((response, index) => (
            <div
              key={index}
              className={`response-text ${
                response.isUser ? 'user-query' : 'gemini-response'
              } ${index === 0 && !response.isUser ? 'fw-bold' : ''}`}
            >
              {response.isUser ? (
                response.text
              ) : (
                <ReactMarkdown>{response.text}</ReactMarkdown>
              )}
            </div>
          ))}
          {loading && (
            <div className="loading text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden text-white">Loading...</span>
              </div>
            </div>
          )}
        </div>
        {/* Added */}
        {isEditingFlashcard && (
          <div className="edit-flashcard-panel">
            <h2>Edit Your Flashcard</h2>
            <textarea
              value={flashcardFront}
              onChange={(e) => setFlashcardFront(e.target.value)}
              placeholder="Front of Flashcard"
              className="edit-flashcard-input"
            />
            <textarea
              value={flashcardBack}
              onChange={(e) => setFlashcardBack(e.target.value)}
              placeholder="Back of Flashcard"
              className="edit-flashcard-input"
            />

            {/* Dropdown for selecting a flashcard set */}
            {console.log('HERE@##@', flashcardSets)}
            <div className="flashcard-set-selection">
              <label>Select a Set (or leave as 'No set')</label>
              <select
                value={selectedSet}
                onChange={(e) => setSelectedSet(e.target.value)}
                className="form-control bg-gray-800 text-white p-2 rounded"
              >
                <option value="">No set</option>
                {flashcardSets.map((set) => (
                  <option key={set.set_id} value={set.set_id}>
                    {set.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flashcard-actions">
              <button
                className="btn btn-primary text-white"
                onClick={submitFlashcard}
              >
                Save Flashcard
              </button>
              <button
                className="btn btn-secondary text-white"
                onClick={() => setIsEditingFlashcard(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="input-area">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter a prompt here"
            className="form-control bg-inherit text-white"
          />
          <button
            onClick={getResponseForGivenPrompt}
            className="btn btn-primary"
          >
            Send
          </button>
          <button onClick={addFlashcard} className="mx-2">
            Add Flashcard
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatBot;
