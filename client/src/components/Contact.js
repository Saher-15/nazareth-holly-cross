import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Contact.css'; // Import CSS file for styling
import "../styles/Candle.css";
import "../App.css";
import { API_URL } from '../config';

function Contact() {
  // State to store form data
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    msg: ''
  });

  // State to manage the visibility of the message
  const [showMessage, setShowMessage] = useState(false);

  // Handler function to update form data
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  // Handler function to submit form data
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.fullName === '' || formData.email === '' || formData.phone === '' || formData.msg === '') {
      alert('Please fill in all fields');
      return;
    }

    try {
      // Send form data to server
      await axios.post(`${API_URL}/contact/contact_us_request`, formData);

      // Handle success

      // Reset form fields
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        msg: ''
      });

      // Show success message for 2 seconds
      setShowMessage(true);
      setTimeout(() => {
        setShowMessage(false);
      }, 3000);
    } catch (error) {
      // Handle error
      console.error('Error sending form data:');
      alert('Failed to send form data');
    }
  };

  useEffect(() => {
    // Scroll to the top of the page when the component mounts
    window.scrollTo(0, 0);
  }, []); // Empty dependency array ensures this effect runs only once, on mount

  return (
    <div className="contact">
      {/* <div className="background-img" style={{ backgroundImage: "url('/images/jesus.png')" }}></div> */}
      <div className="leftSide">
        {showMessage && <p style={{ color: "#fff" }}>Message submitted successfully!</p>}
      </div>
      <div className="rightSide">
        <form className="contact-form center-form" onSubmit={handleSubmit}>
          <label
            htmlFor="first-name"
            className="block text-sm font-semibold leading-6 text-accent-content"
          >
            <h2 className='h2t'>CONTACT US</h2>
          </label>
          <br />
          <div className="form-group">
            <div className="mt-2.5">
              <input
                type="text"
                name="fullName"
                id="fullName"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="given-name"
                className="block w-full rounded-md border-0 px-3.5 py-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>

            <div className="mt-2.5">
              <input
                type="email"
                name="email"
                id="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="block w-full rounded-md border-0 px-3.5 py-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>

            <div className="mt-2.5">
              <input
                type="text"
                name="phone"
                id="phone"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={handleChange}
                required
                autoComplete="family-name"
                className="block w-full rounded-md border-0 px-3.5 py-2 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>

            <textarea
              placeholder="Text"
              id="msg"
              name="msg"
              value={formData.msg}
              onChange={handleChange}
              required
            />
            <br />
          </div>

          <div className='hero-btns-candle'>
            <button type="submit">Submit</button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default Contact;
