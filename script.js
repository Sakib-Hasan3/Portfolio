// Dark/Light Mode Toggle
const toggleThemeBtn = document.createElement('div');
toggleThemeBtn.className = 'toggle-theme';
toggleThemeBtn.innerHTML = '<i class="fas fa-adjust"></i>';
document.body.appendChild(toggleThemeBtn);

toggleThemeBtn.addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
});

window.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light');
    }

    // Animate skills progress bars
    const progressBars = document.querySelectorAll('.progress-done');
    progressBars.forEach(bar => {
        bar.style.width = bar.getAttribute('data-done') + '%';
    });

    // Initialize AOS
    AOS.init({
        duration: 1000,
        once: true
    });
});
