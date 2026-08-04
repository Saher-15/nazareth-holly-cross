'use client';
import React, { createContext, useContext, useReducer, useEffect } from 'react';

const ShopContext = createContext(null);

const initialState = {
  cart: [],
  cartOpen: false,
  wishlist: [],
  currency: 'USD',
};

function shopReducer(state, action) {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const { product, color, quantity = 1 } = action.payload;
      const existingIndex = state.cart.findIndex(
        (item) => item._id === product._id && item.selectedColor === color
      );
      if (existingIndex >= 0) {
        const updatedCart = [...state.cart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: updatedCart[existingIndex].quantity + quantity,
        };
        return { ...state, cart: updatedCart };
      }
      return {
        ...state,
        cart: [...state.cart, { ...product, selectedColor: color, quantity }],
      };
    }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter(
          (item) =>
            !(item._id === action.payload.id && item.selectedColor === action.payload.color)
        ),
      };
    case 'UPDATE_QUANTITY': {
      const { id, color, quantity } = action.payload;
      if (quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter(
            (item) => !(item._id === id && item.selectedColor === color)
          ),
        };
      }
      return {
        ...state,
        cart: state.cart.map((item) =>
          item._id === id && item.selectedColor === color
            ? { ...item, quantity }
            : item
        ),
      };
    }
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'TOGGLE_CART':
      return { ...state, cartOpen: !state.cartOpen };
    case 'SET_CART_OPEN':
      return { ...state, cartOpen: action.payload };
    case 'ADD_TO_WISHLIST': {
      const exists = state.wishlist.find((item) => item._id === action.payload._id);
      if (exists) return state;
      return { ...state, wishlist: [...state.wishlist, action.payload] };
    }
    case 'REMOVE_FROM_WISHLIST':
      return {
        ...state,
        wishlist: state.wishlist.filter((item) => item._id !== action.payload),
      };
    case 'LOAD_FROM_STORAGE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export function ShopProvider({ children }) {
  const [state, dispatch] = useReducer(shopReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('nhc_cart');
      const savedWishlist = localStorage.getItem('nhc_wishlist');
      if (savedCart || savedWishlist) {
        dispatch({
          type: 'LOAD_FROM_STORAGE',
          payload: {
            cart: savedCart ? JSON.parse(savedCart) : [],
            wishlist: savedWishlist ? JSON.parse(savedWishlist) : [],
          },
        });
      }
    } catch (e) {
      console.error('Error loading cart from storage:', e);
    }
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('nhc_cart', JSON.stringify(state.cart));
    } catch (e) {
      console.error('Error saving cart:', e);
    }
  }, [state.cart]);

  useEffect(() => {
    try {
      localStorage.setItem('nhc_wishlist', JSON.stringify(state.wishlist));
    } catch (e) {
      console.error('Error saving wishlist:', e);
    }
  }, [state.wishlist]);

  const cartCount = state.cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = state.cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const addToCart = (product, color = null, quantity = 1) => {
    dispatch({ type: 'ADD_TO_CART', payload: { product, color, quantity } });
    dispatch({ type: 'SET_CART_OPEN', payload: true });
  };

  const removeFromCart = (id, color) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: { id, color } });
  };

  const updateQuantity = (id, color, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, color, quantity } });
  };

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const toggleCart = () => dispatch({ type: 'TOGGLE_CART' });

  const toggleWishlist = (product) => {
    const inWishlist = state.wishlist.some((item) => item._id === product._id);
    if (inWishlist) {
      dispatch({ type: 'REMOVE_FROM_WISHLIST', payload: product._id });
    } else {
      dispatch({ type: 'ADD_TO_WISHLIST', payload: product });
    }
  };

  const isInWishlist = (id) => state.wishlist.some((item) => item._id === id);

  return (
    <ShopContext.Provider
      value={{
        ...state,
        cartCount,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        toggleCart,
        toggleWishlist,
        isInWishlist,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}

export default ShopContext;
