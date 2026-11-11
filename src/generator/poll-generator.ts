import { Quiz, QuizQuestion } from "../language/generated/ast";

/**
 * Generates HTML for Quiz blocks
 */
export class PollGenerator {
    private pollCounter = 0;

    /**
     * Generate HTML for a Quiz block
     * Creates nested sections for navigation between questions
     */
    public generateQuiz(quiz: Quiz): string {
        const title = quiz.title.replace(/^"|"$/g, '');
        const showJoinQrCode = quiz.showJoinQrCode ?? true; // Default to true if not specified

        let html = '';

        // Create intro slide with QR code only if showJoinQrCode is true
        if (showJoinQrCode) {
            html += `        <section>\n`;
            html += `            <h2>${title}</h2>\n`;
            html += `            <div class="qr-code-container">\n`;
            html += `                <img class="qr-code" alt="QR Code to join" />\n`;
            html += `                <p>Scan to join and participate</p>\n`;
            html += `            </div>\n`;
            html += `        </section>\n`;
        }

        // Create a slide for each question
        quiz.questions.forEach((question) => {
            html += `        <section>\n`;
            html += this.generateQuestion(question);
            html += `        </section>\n`;
        });

        return html;
    }

    /**
     * Generate HTML for a single question
     */
    private generateQuestion(question: QuizQuestion): string {
        const pollId = `poll-${this.pollCounter++}`;
        const hasCorrectAnswers = question.correctAnswers && question.correctAnswers.length > 0;
        return this.generateMultipleChoiceQuestion(question, pollId, hasCorrectAnswers);
    }

    /**
     * Generate HTML for a multiple choice question
     */
    private generateMultipleChoiceQuestion(question: any, pollId: string, isQuiz: boolean): string {
        const questionText = question.text.replace(/^"|"$/g, '');
        const showResultsOnDemand = question.showResultsOnDemand ?? false;
        const visualization = question.visualizationType || 'barChart';

        let html = `            <h3>${questionText}</h3>\n`;

        // Poll buttons (always visible at start)
        html += `            <div class="poll" data-poll="${pollId}" data-auto-show-results="${!showResultsOnDemand}">\n`;
        question.choices.forEach((choice: any) => {
            const choiceId = choice.choice.replace(/^"|"$/g, '');
            const choiceText = choice.text.replace(/^"|"$/g, '');
            html += `                <button data-value="${choiceId}">${choiceText}</button>\n`;
        });
        html += `            </div>\n`;

        // Show/Hide Results button (only if showResultsOnDemand is true)
        if (showResultsOnDemand) {
            html += `            <button class="toggle-results-btn" data-poll="${pollId}">Show Results</button>\n`;
        }

        // Results section (always hidden at start)
        html += `            <div class="results" data-poll="${pollId}" data-visualization="${visualization}" data-is-quiz="${isQuiz}" style="display: none;">\n`;
        html += `                <p><strong>Results:</strong> <span class="voters" data-poll="${pollId}">0</span> votes</p>\n`;
        html += `                <canvas id="chart-${pollId}" width="400" height="300"></canvas>\n`;
        // Hidden data for chart (updated by poll plugin)
        html += `                <div style="display: none;">\n`;
        question.choices.forEach((choice: any) => {
            const choiceId = choice.choice.replace(/^"|"$/g, '');
            const choiceText = choice.text.replace(/^"|"$/g, '');
            // Check if this choice is correct (for quizzes)
            const isCorrect = isQuiz && question.correctAnswers &&
                question.correctAnswers.some((ans: any) => ans.$refText === choiceId);
            html += `                    <p data-correct="${isCorrect}">${choiceText}: <span data-value="${choiceId}">0</span></p>\n`;
        });
        html += `                </div>\n`;
        html += `            </div>\n`;

        return html;
    }

    /**
     * Reset the poll counter
     */
    public resetCounter(): void {
        this.pollCounter = 0;
    }

    /**
     * Get CSS styles for polls and quizzes
     */
    public getPollCSS(): string {
        return `
        /* Poll/Quiz responsive styling */
        .reveal .slides section {
            padding: 20px 0 !important;
        }

        .poll {
            display: flex;
            flex-direction: column;
            gap: 0.15em;
            max-width: 700px;
            margin: 0.12em auto 0.1em auto;
        }

        .poll button {
            font-size: 0.7em !important;
            padding: 0.35em 0.7em !important;
            margin: 0 !important;
            white-space: normal;
            text-align: left;
            width: 100%;
        }

        .reveal section h2 {
            text-align: center;
        }

        .reveal section h3 {
            font-size: 1em;
            margin: 0.2em 0 1.0em 0;
            text-align: center;
        }

        .results {
            font-size: 0.85em;
            margin-top: 0.5em !important;
            text-align: center;
        }

        .results canvas {
            max-height: 250px;
        }

        .qr-code-container {
            text-align: center;
            margin: 2em auto;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .qr-code-container .qr-code {
            display: inline-block;
            margin: 1em auto;
        }

        .qr-code img,
        .qr-code-container img {
            margin: 0 auto;
            display: block !important;
        }

        .qr-code-container p {
            font-size: 0.9em;
            font-style: italic;
            margin-top: 1em;
        }

        .toggle-results-btn {
            background-color: #2a76dd;
            color: white;
            border: none;
            padding: 0.25em 0.8em;
            font-size: 0.65em;
            border-radius: 3px;
            cursor: pointer;
            transition: background-color 0.3s;
            margin: 1.0em auto;
            display: block;
        }

        .toggle-results-btn:hover {
            background-color: #1e5bb8;
        }

        .results canvas {
            margin: 0.5em auto;
            display: block;
        }

        /* Hide show results button for guests */
        body.guest-mode .toggle-results-btn {
            display: none !important;
        }
        `;
    }

    /**
     * Get JavaScript code for polls and quizzes
     */
    public getPollJS(): string {
        return `
        // Detect guest mode and apply CSS class early
        const urlParams = new URLSearchParams(window.location.search);
        const isGuest = urlParams.get('guest') === 'true';
        if (isGuest) {
            document.body.classList.add('guest-mode');
        }

        // Join seminar room (host or participant)
        Reveal.on('ready', function() {
            console.log('Current URL:', window.location.href);
            console.log('isGuest:', isGuest);
            console.log('RevealSeminar available:', typeof RevealSeminar !== 'undefined');

            if (isGuest) {
                console.log('Joining as GUEST/PARTICIPANT without password');
                RevealSeminar.join_room();
            } else {
                console.log('Joining as HOST with password');
                RevealSeminar.open_or_join_room('123456');
            }
        });

        // Generate QR code once and set it for all quiz/poll
        Reveal.on('ready', function() {
            let url = window.location.href;
            if (url.startsWith('file://')) {
                const hostname = window.location.hostname || 'localhost';
                const port = 3000;
                const pathname = window.location.pathname;
                const pathMatch = pathname.match(/(?:sse-dsl-SlideDeckML|SlideDeck)(\\/.+)/) || pathname.match(/([^/]+\.html)$/);
                const path = pathMatch ? (pathMatch[1] || '/' + pathMatch[0]) : 'index.html';
                url = 'http://' + hostname + ':' + port + path;
            }

            const baseUrl = url.split('?')[0];
            const guestUrl = baseUrl + '?guest=true';

            const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(guestUrl);
            document.querySelectorAll('img.qr-code').forEach(function(img) {
                img.src = qrUrl;
            });
        });

        // Store chart instances
        const chartInstances = {};

        // Toggle results button handler (host only)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('toggle-results-btn')) {
                const pollId = e.target.dataset.poll;
                const pollDiv = document.querySelector('.poll[data-poll="' + pollId + '"]');
                const resultsDiv = document.querySelector('.results[data-poll="' + pollId + '"]');

                if (resultsDiv.style.display === 'none') {
                    if (pollDiv) pollDiv.style.display = 'none';
                    resultsDiv.style.display = 'block';
                    e.target.textContent = 'Hide Results';
                    updateChart(pollId);
                } else {
                    if (pollDiv) pollDiv.style.display = 'flex';
                    resultsDiv.style.display = 'none';
                    e.target.textContent = 'Show Results';
                }
            }
        });

        // Auto-show results when voting (for showResultsOnDemand: false, host only)
        document.addEventListener('click', function(e) {
            if (e.target.matches('.poll[data-auto-show-results="true"] button')) {
                const pollDiv = e.target.closest('.poll');
                const pollId = pollDiv.dataset.poll;
                const resultsDiv = document.querySelector('.results[data-poll="' + pollId + '"]');

                // Wait a bit for the vote to be registered
                setTimeout(function() {
                    pollDiv.style.display = 'none';
                    resultsDiv.style.display = 'block';
                    updateChart(pollId);
                }, 500);
            }
        });

        // Listen for vote updates from the poll plugin (host only)
        if (!isGuest) {
            Reveal.on('received', function(event) {
                if (event.content && event.content.type === 'poll') {
                    // A vote was received, update all visible charts
                    document.querySelectorAll('.results').forEach(function(resultsDiv) {
                        const displayStyle = window.getComputedStyle(resultsDiv).display;
                        if (displayStyle !== 'none') {
                            const pollId = resultsDiv.dataset.poll;
                            setTimeout(function() {
                                updateChart(pollId);
                            }, 300); // Small delay to let the poll plugin update the data
                        }
                    });
                }
            });

            // Refresh charts periodically when visible (host only)
            setInterval(function() {
                document.querySelectorAll('.results').forEach(function(resultsDiv) {
                    const displayStyle = window.getComputedStyle(resultsDiv).display;
                    if (displayStyle !== 'none') {
                        const pollId = resultsDiv.dataset.poll;
                        updateChart(pollId);
                    }
                });
            }, 1000); // Check every seconds for updates
        }

        // Update or create chart for a poll
        function updateChart(pollId) {
            const resultsDiv = document.querySelector('.results[data-poll="' + pollId + '"]');
            const visualization = resultsDiv.dataset.visualization;
            const isQuiz = resultsDiv.dataset.isQuiz === 'true';
            const canvas = document.querySelector('#chart-' + pollId);

            // Get data from results spans
            const valueSpans = resultsDiv.querySelectorAll('span[data-value]');
            const labels = [];
            const data = [];
            const defaultColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];
            const colors = [];

            valueSpans.forEach(function(span, index) {
                const parentP = span.parentElement;
                const label = parentP.textContent.split(':')[0].trim();
                const value = parseInt(span.textContent) || 0;
                labels.push(label);
                data.push(value);

                // Determine color based on quiz/poll and correct/incorrect
                if (isQuiz) {
                    const isCorrect = parentP.dataset.correct === 'true';
                    colors.push(isCorrect ? '#4CAF50' : '#F44336'); // Green for correct, red for incorrect
                } else {
                    colors.push(defaultColors[index % defaultColors.length]);
                }
            });

            // Destroy existing chart if it exists
            if (chartInstances[pollId]) {
                chartInstances[pollId].destroy();
            }

            // Create new chart
            const ctx = canvas.getContext('2d');
            const chartType = visualization === 'pieChart' ? 'pie' : 'bar';

            chartInstances[pollId] = new Chart(ctx, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Votes',
                        data: data,
                        backgroundColor: colors,
                        borderColor: colors.map(c => c + 'CC'),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            display: chartType === 'pie',
                            position: 'bottom'
                        }
                    },
                    scales: chartType === 'bar' ? {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    } : {}
                }
            });
        }
        `;
    }
}
