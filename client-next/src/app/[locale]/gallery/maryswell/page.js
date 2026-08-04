'use client';
import GalleryLayout from '@/components/GalleryLayout';

const GALLERY_DATA = {
  latin: {
    title: 'Basilica of the Annunciation',
    subtitle: 'Latin Church — Nazareth',
    description: 'The largest church in the Middle East, built over the grotto where the Angel Gabriel appeared to the Virgin Mary. A UNESCO-recognized site of profound spiritual significance.',
    photos: [
      { id: 1, title: 'Main Facade', emoji: '⛪' },
      { id: 2, title: 'The Grotto', emoji: '🕯' },
      { id: 3, title: 'Upper Church', emoji: '⛪' },
      { id: 4, title: 'Interior Mosaic', emoji: '🎨' },
      { id: 5, title: 'Bell Tower', emoji: '🔔' },
      { id: 6, title: 'Courtyard', emoji: '🌿' },
    ],
    mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d831.1!2d35.2966!3d32.7019!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151c4b9b9b9b9b9b%3A0x0!2sBasilica+of+the+Annunciation!5e0!3m2!1sen!2sus!4v1234567890',
  },
  greek: {
    title: 'Greek Orthodox Church',
    subtitle: 'Church of the Annunciation — Nazareth',
    description: "Built over the ancient spring where the Angel Gabriel first appeared to Mary while she was drawing water. The spring still flows beneath the church today.",
    photos: [
      { id: 1, title: 'Church Exterior', emoji: '🏛' },
      { id: 2, title: 'The Ancient Spring', emoji: '💧' },
      { id: 3, title: 'Icon Screen', emoji: '✝' },
      { id: 4, title: 'Interior', emoji: '🕯' },
      { id: 5, title: 'Byzantine Mosaic', emoji: '🎨' },
      { id: 6, title: 'Bell Tower', emoji: '🔔' },
    ],
    mapUrl: null,
  },
  maryswell: {
    title: "Mary's Well",
    subtitle: 'The Ancient Spring of Nazareth',
    description: "For thousands of years, the women of Nazareth drew water from this spring. According to tradition, it was here that the young Mary came daily — and perhaps first heard the divine call.",
    photos: [
      { id: 1, title: 'The Well', emoji: '💧' },
      { id: 2, title: 'Plaza', emoji: '🌿' },
      { id: 3, title: 'Ancient Stones', emoji: '🪨' },
      { id: 4, title: 'Evening Light', emoji: '🌅' },
      { id: 5, title: 'Fountain', emoji: '💧' },
      { id: 6, title: 'Historical Sign', emoji: '📜' },
    ],
    mapUrl: null,
  },
  'old-city': {
    title: 'Old City of Nazareth',
    subtitle: 'The Ancient Heart of the City',
    description: "The ancient market and neighborhoods of Nazareth, where artisans and merchants carry on traditions spanning millennia. Walk through the same streets Jesus once walked.",
    photos: [
      { id: 1, title: 'Market Alley', emoji: '🕌' },
      { id: 2, title: 'Spice Market', emoji: '🌶' },
      { id: 3, title: 'Ancient Gate', emoji: '🚪' },
      { id: 4, title: 'Craftsmen', emoji: '🪵' },
      { id: 5, title: 'Street View', emoji: '🏘' },
      { id: 6, title: 'Evening Lights', emoji: '🌃' },
    ],
    mapUrl: null,
  },
  nazareth: {
    title: 'Nazareth',
    subtitle: 'City of Jesus — Galilee, Israel',
    description: "The city where Jesus grew up, where he took his first steps and learned his father's trade. Today a vibrant city of 80,000, Nazareth remains a living testament to faith.",
    photos: [
      { id: 1, title: 'City Panorama', emoji: '🌆' },
      { id: 2, title: 'Galilee Hills', emoji: '⛰' },
      { id: 3, title: 'City Center', emoji: '🏙' },
      { id: 4, title: 'Sunset View', emoji: '🌅' },
      { id: 5, title: 'Church Spires', emoji: '⛪' },
      { id: 6, title: 'Nazareth at Night', emoji: '🌙' },
      { id: 7, title: 'Gardens', emoji: '🌿' },
      { id: 8, title: 'Local Life', emoji: '👥' },
    ],
    mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d13454.024889539!2d35.29082!3d32.70032!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x151c4b9d51d3d5b9%3A0x43e1c35dae553fb4!2sNazareth%2C%20Israel!5e0!3m2!1sen!2sus!4v1234567890',
  },
};

export default function GalleryPage({ params }) {
  const location = 'maryswell';
  const data = GALLERY_DATA[location] || GALLERY_DATA.nazareth;
  return <GalleryLayout {...data} />;
}
