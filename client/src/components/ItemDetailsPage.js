import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; // Import axios for making HTTP requests
import { API_URL } from '../config';

const ItemDetailsPage = () => {
  const { _id } = useParams(); // Get the item ID from the URL params
  const [item, setItem] = useState(null); // State to store item data

  // Fetch item data from the API based on the item ID
  useEffect(() => {
    async function fetchItemData() {
      try {
        const response = await axios.get(`${API_URL}/product/getNProducts?_id=${_id}`);
        setItem(response.data); // Set the item data in state
      } catch (error) {
        console.error('Error fetching item data:');
      }
    }

    fetchItemData(); // Call the fetchItemData function when the component mounts
  }, [_id]); // Include id in the dependency array to re-fetch data when id changes

  // Render item details
  return (
    <div>
      <h2>Item Details</h2>
      {item ? (
        <div>
          <p>Name: {item.name}</p>
          <p>Price: ${item.price}</p>
          <p>Description: {item.description}</p>
          <img src={item.img} alt="Item" />
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

export default ItemDetailsPage;
