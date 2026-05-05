// Get the hamburger menu and nav links elements
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');

// Add event listener to the hamburger menu
hamburger.addEventListener('click', () => {
  // Toggle the nav links
  navLinks.classList.toggle('show');
});

// Add event listener to the nav links
navLinks.addEventListener('click', (e) => {
  // If the click is on a link, hide the nav links
  if (e.target.tagName === 'A') {
    navLinks.classList.remove('show');
  }
});