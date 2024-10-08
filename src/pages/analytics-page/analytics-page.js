import React, { useState, useEffect } from 'react';
import { supabase } from '../../components/supabaseClient';
import NavigationBar from '../../components/NavigationBar/NavigationBar';
import './analytics-page.css';

function AnalyticsPage({ user }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from('Chats')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching categories:', error);
        return;
      }

      console.log('Data:', data);

      // Count occurrences of each category
      const categoryCounts = data.reduce((acc, item) => {
        acc[item.category] = acc[item.category] ? acc[item.category] + 1 : 1;
        return acc;
      }, {});

      // Convert object to array of categories for easy rendering
      const formattedCategories = Object.entries(categoryCounts).map(
        ([category, count]) => ({
          category,
          count,
        })
      );

      // Log the formatted categories to the console
      console.log('Fetched Categories:', formattedCategories);

      // Update the state with the categories
      setCategories(formattedCategories);
    };

    fetchCategories();
  }, [user.id]);

  return (
    <div className="page-container">
      <NavigationBar />
      <div className="analytics-container">
        <div className="greeting-container py-5">
          <h1 className="greeting-text">Chatting Trends</h1>
          <h2 className="text-white text-2xl">
            What have you been asking about the most?
          </h2>
        </div>
        <div className="analytics-content">
          {categories.length > 0 ? (
            categories.map((item) => (
              <div key={item.category} className="category-card">
                <h2>{item.category}</h2>
                <p>Count: {item.count}</p>
              </div>
            ))
          ) : (
            <p>No categories available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
