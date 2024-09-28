import React, { useState } from 'react';
import './chat-page.css';  // Import the CSS for styling
import storeChat from '../../pages/database-example/db-store-chat';
import storeFlashcard from '../../pages/database-example/db-store-flashcard';
import NavigationBar from '../../components/NavigationBar/NavigationBar';

function ChatBot({ user }) {
  const [inputValue, setInputValue] = useState('');
  const [promptResponses, setPromptResponses] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      getResponseForGivenPrompt();
    }
  };

  const getResponseForGivenPrompt = async () => {
    if (!inputValue.trim()) return; // Prevent sending empty queries
  
    try {
      const userQuery = inputValue; // Store user query
      setLoading(true);
      setPromptResponses([{ text: userQuery, isUser: true }, ...promptResponses]);
      setInputValue('');
  
      // Call the Gemini API
      const apiKeyGemini = process.env.REACT_APP_GEMINI_API_KEY;
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKeyGemini);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(userQuery);
      const response = result.response;
      const text = response.text();
      console.log(text);
  
      // Update prompt responses on UI
      setPromptResponses([{ text, isUser: false }, { text: userQuery, isUser: true }, ...promptResponses]);
      setLoading(false);
  
      // Generate required variables for storing in Supabase
      const category = "General"; // You can modify this based on context or content type
      const userId = user?.id; // You would replace this with actual userId, e.g., from a login session
      console.log(userId);
      const isFlashcard = true; // Modify this flag as needed for flashcard-related queries
  
      // Call the function to store chat in Supabase
      await storeChat(userQuery, text, category, userId, isFlashcard);

      // Conditionally store flashcard when `isFlashcard` is true
      if (isFlashcard) {
        await storeFlashcard(userQuery, text, userId);
      }
  
    } catch (error) {
      console.log(error);
      console.log("Something Went Wrong");
      setLoading(false);
    }
  };

  return (
    <div className="flex">
      <NavigationBar />
      <div className="chat-container">
        <div className="chat-window">
          {loading && (
            <div className="loading text-center">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}

          {promptResponses.map((response, index) => (
            <div key={index} className={`response-text ${response.isUser ? 'user-query' : 'gemini-response'} ${index === 0 && !response.isUser ? 'fw-bold' : ''}`}>
              {response.text}
            </div>
          ))}
        </div>

        <div className="input-area">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress} // Trigger response on "Enter"
            placeholder="Ask Me Something You Want"
            className="form-control"
          />
          <button onClick={getResponseForGivenPrompt} className="btn btn-primary">Send</button>
        </div>
      </div>
    </div>
  );
}

export default ChatBot;