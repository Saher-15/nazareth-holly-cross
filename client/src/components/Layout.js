import React from 'react'
import Footer from '../components/Footer'
import NavBar from '../components/Navbar'

const Layout = ({ children }) => {
  return (
    <div>
      <NavBar />
      {children}
      <Footer />
    </div>
  )
}

export default Layout