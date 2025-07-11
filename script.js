let attendanceChart;
let subjects = JSON.parse(localStorage.getItem("subjects")) || [];

function saveSubjects() {
  localStorage.setItem("subjects", JSON.stringify(subjects));
}

function getDaysPassed(startDate, totalDays, classDays = [], holidays = [], today = new Date(), attendedDates = []) {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    console.error(`Invalid startDate: ${startDate}`);
    return 0;
  }
  if (start > today) {
    return 0;
  }

  let daysPassed = 0;
  const current = new Date(start);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  while (current <= today && daysPassed < totalDays) {
    const dateString = current.toISOString().split("T")[0];
    const dayOfWeek = dayNames[current.getDay()];
    if (classDays.includes(dayOfWeek) && !holidays.includes(dateString)) {
      daysPassed++;
    }
    current.setDate(current.getDate() + 1);
  }
  return Math.min(Math.max(attendedDates.length, daysPassed), totalDays);
}

function populateTable() {
  const table = document.getElementById("attendanceTable");
  table.innerHTML = "";

  subjects.forEach((sub, index) => {
    const attended = (sub.attendedDates || []).length;
    const passed = getDaysPassed(sub.startDate, sub.totalDays, sub.classDays || [], sub.holidays || [], new Date(), sub.attendedDates || []);
    const net = passed > 0 ? ((attended / passed) * 100).toFixed(1) : 0;
    const final = ((attended / sub.totalDays) * 100).toFixed(1);

    const row = document.createElement("tr");
    row.classList.add("subject-row");
    row.innerHTML = `
      <td>${sub.name}</td>
      <td>${attended}</td>
      <td>${sub.totalDays}</td>
      <td>${passed}</td>
      <td class="${net < 75 ? 'low' : 'high'}">${net}%</td>
      <td class="${final < 75 ? 'low' : 'high'}">${final}%</td>
      <td>
        <button onclick="markAttendance(${index})" aria-label="Mark attendance for ${sub.name}">➕</button>
        <button onclick="editSubject(${index})" aria-label="Edit ${sub.name}">✏️</button>
        <button onclick="deleteSubject(${index})" aria-label="Delete ${sub.name}">🗑️</button>
        <button onclick="addHoliday(${index})" aria-label="Mark holiday for ${sub.name}">📅</button>
      </td>
    `;
    table.appendChild(row);

    const needed = Math.max(0, Math.ceil((0.75 * sub.totalDays) - attended));
    const remaining = sub.totalDays - passed;
    const holidays = (sub.holidays || []).join(", ") || "None";
    const classDays = (sub.classDays || []).join(", ") || "None";
    const attendedDates = (sub.attendedDates || []).length > 0
      ? sub.attendedDates.map(d => `${d} <button class="edit-btn" onclick="editAttendance(${index}, '${d}')" aria-label="Edit attendance for ${sub.name} on ${d}">🖌️</button>`).join(", ")
      : "None";
    const infoRow = document.createElement("tr");
    infoRow.classList.add("info-row");
    infoRow.innerHTML = `
      <td colspan="7">
        <button class="dropdown-toggle" aria-expanded="false" aria-label="Toggle details for ${sub.name}">Know More</button>
        <div class="dropdown-content" style="display: none;">
          <p>➕ Need to attend <b>${needed}</b> more of remaining <b>${remaining}</b> classes to hit 75%.</p>
          <p>📅 Holidays: ${holidays}</p>
          <p>🕒 Class Days: ${classDays}</p>
          <p>✅ Attended Dates: ${attendedDates}</p>
        </div>
      </td>
    `;
    table.appendChild(infoRow);

    const toggleButton = infoRow.querySelector(".dropdown-toggle");
    const content = infoRow.querySelector(".dropdown-content");
    toggleButton.addEventListener("click", () => {
      const isVisible = content.style.display === "block";
      content.style.display = isVisible ? "none" : "block";
      toggleButton.setAttribute("aria-expanded", !isVisible);
    });
  });
}

function editAttendance(index, oldDate) {
  const sub = subjects[index];
  if (confirm(`Remove attendance for ${sub.name} on ${oldDate}?`)) {
    sub.attendedDates = sub.attendedDates.filter(d => d !== oldDate);
    const newDate = prompt(`Enter new attendance date for ${sub.name} (YYYY-MM-DD, leave blank to only remove):`, new Date().toISOString().split("T")[0]);
    if (newDate) {
      const attendanceDate = new Date(newDate);
      const startDate = new Date(sub.startDate);
      const today = new Date();
      if (isNaN(attendanceDate.getTime())) {
        alert("Invalid date format. Please use YYYY-MM-DD.");
        sub.attendedDates.push(oldDate); // Revert removal
        return;
      }
      if (attendanceDate < startDate || attendanceDate > today) {
        alert("Attendance date must be between the start date and today.");
        sub.attendedDates.push(oldDate); // Revert removal
        return;
      }
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayOfWeek = dayNames[attendanceDate.getDay()];
      if (!sub.classDays.includes(dayOfWeek)) {
        alert(`No class scheduled for ${sub.name} on ${dayOfWeek}.`);
        sub.attendedDates.push(oldDate); // Revert removal
        return;
      }
      const dateString = attendanceDate.toISOString().split("T")[0];
      if (sub.holidays && sub.holidays.includes(dateString)) {
        alert("Cannot mark attendance on a holiday.");
        sub.attendedDates.push(oldDate); // Revert removal
        return;
      }
      if (sub.attendedDates.includes(dateString)) {
        alert("Attendance already marked for this date.");
        sub.attendedDates.push(oldDate); // Revert removal
        return;
      }
      sub.attendedDates.push(dateString);
    }
    saveSubjects();
    populateTable();
    drawChart();
  }
}

function drawChart() {
  const labels = subjects.map(s => s.name);
  const attendedData = subjects.map(s => (s.attendedDates || []).length);
  const passedData = subjects.map(s => getDaysPassed(s.startDate, s.totalDays, s.classDays || [], s.holidays || [], new Date(), s.attendedDates || []));
  const totalData = subjects.map(s => s.totalDays);
  const maxTotal = Math.max(...totalData);

  const ctx = document.getElementById("attendanceChart").getContext("2d");

  if (attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Attended", data: attendedData, backgroundColor: "rgba(54, 162, 235, 0.7)" },
        { label: "Classes Passed", data: passedData, backgroundColor: "rgba(255, 206, 86, 0.7)" },
        { label: "Total Classes", data: totalData, backgroundColor: "rgba(255, 99, 132, 0.7)" },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "📊 Attendance Overview by Subject", font: { size: 18 } },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const sub = subjects[ctx.dataIndex];
              const final = ((sub.attendedDates || []).length / sub.totalDays * 100).toFixed(1);
              return `Final % (if stop now): ${final}%`;
            },
          },
        },
      },
      scales: {
        x: { stacked: false, title: { display: true, text: "Subjects" } },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Classes" },
          ticks: { stepSize: 5 },
          suggestedMax: maxTotal + 5,
        },
      },
    },
  });
}

function markAttendance(index) {
  const sub = subjects[index];
  const date = prompt(`Enter attendance date for ${sub.name} (YYYY-MM-DD):`, new Date().toISOString().split("T")[0]);
  if (!date) return;

  const attendanceDate = new Date(date);
  const startDate = new Date(sub.startDate);
  const today = new Date();
  if (isNaN(attendanceDate.getTime())) {
    alert("Invalid date format. Please use YYYY-MM-DD.");
    return;
  }
  if (attendanceDate < startDate || attendanceDate > today) {
    alert("Attendance date must be between the start date and today.");
    return;
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = dayNames[attendanceDate.getDay()];
  if (!sub.classDays.includes(dayOfWeek)) {
    alert(`No class scheduled for ${sub.name} on ${dayOfWeek}.`);
    return;
  }
  const dateString = attendanceDate.toISOString().split("T")[0];
  if (sub.holidays && sub.holidays.includes(dateString)) {
    alert("Cannot mark attendance on a holiday.");
    return;
  }
  if (!sub.attendedDates) sub.attendedDates = [];
  if (sub.attendedDates.includes(dateString)) {
    alert("Attendance already marked for this date.");
    return;
  }

  sub.attendedDates.push(dateString);
  saveSubjects();
  populateTable();
  drawChart();
}

function deleteSubject(index) {
  if (confirm(`Are you sure you want to delete ${subjects[index].name}?`)) {
    subjects.splice(index, 1);
    saveSubjects();
    populateTable();
    drawChart();
  }
}

function editSubject(index) {
  const sub = subjects[index];
  document.getElementById("subjectName").value = sub.name;
  document.getElementById("attended").value = (sub.attendedDates || []).length;
  document.getElementById("totalDays").value = sub.totalDays;
  document.getElementById("startDate").value = sub.startDate;

  const checkboxes = document.getElementsByName("classDays");
  checkboxes.forEach(checkbox => {
    checkbox.checked = (sub.classDays || []).includes(checkbox.value);
  });

  subjects.splice(index, 1);
  saveSubjects();
  populateTable();
  drawChart();
}

function addHoliday(index) {
  const sub = subjects[index];
  const date = prompt(`Enter holiday date for ${sub.name} (YYYY-MM-DD):`, new Date().toISOString().split("T")[0]);
  if (!date) return;

  const holidayDate = new Date(date);
  const startDate = new Date(sub.startDate);
  const today = new Date();
  if (isNaN(holidayDate.getTime())) {
    alert("Invalid date format. Please use YYYY-MM-DD.");
    return;
  }
  if (holidayDate < startDate || holidayDate > today) {
    alert("Holiday must be between the start date and today.");
    return;
  }

  if (!sub.holidays) sub.holidays = [];
  const dateString = holidayDate.toISOString().split("T")[0];
  if (sub.holidays.includes(dateString)) {
    alert("This date is already marked as a holiday.");
    return;
  }

  sub.holidays.push(dateString);
  saveSubjects();
  populateTable();
  drawChart();
}

document.getElementById("addSubjectForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("subjectName").value.trim();
  const attended = parseInt(document.getElementById("attended").value);
  const totalDays = parseInt(document.getElementById("totalDays").value);
  const startDate = document.getElementById("startDate").value;
  const classDays = Array.from(document.getElementsByName("classDays"))
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value);

  if (!name) {
    alert("Please enter a subject name.");
    return;
  }
  if (isNaN(attended) || attended < 0) {
    alert("Please enter a valid number of attended classes (0 or more).");
    return;
  }
  if (isNaN(totalDays) || totalDays <= 0) {
    alert("Please enter a valid total number of classes (greater than 0).");
    return;
  }
  if (!startDate || new Date(startDate) > new Date()) {
    alert("Please enter a valid start date (not in the future).");
    return;
  }
  const calculatedDaysPassed = getDaysPassed(startDate, totalDays, classDays, [], new Date(), []);
  if (attended > calculatedDaysPassed) {
    alert(`Attended classes (${attended}) cannot exceed days passed (${calculatedDaysPassed}) based on class days and start date.`);
    return;
  }
  if (classDays.length === 0) {
    alert("Please select at least one class day.");
    return;
  }

  const attendedDates = [];
  if (attended > 0) {
    let tempDate = new Date(startDate);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let count = 0;
    while (tempDate <= new Date() && count < attended) {
      const dateString = tempDate.toISOString().split("T")[0];
      const dayOfWeek = dayNames[tempDate.getDay()];
      if (classDays.includes(dayOfWeek) && !attendedDates.includes(dateString)) {
        attendedDates.push(dateString);
        count++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
  }

  subjects.push({ name, totalDays, startDate, classDays, holidays: [], attendedDates });
  saveSubjects();
  populateTable();
  drawChart();
  e.target.reset();
});



// Initial load
populateTable();
drawChart();

document.addEventListener("DOMContentLoaded", () => {
  const toggleButton = document.getElementById("toggleDarkMode");

  // Apply saved theme on load
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (toggleButton) toggleButton.textContent = "☀️";
  } else {
    if (toggleButton) toggleButton.textContent = "🌙";
  }

  // Add click listener
  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      const isDark = document.body.classList.toggle("dark-mode");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      toggleButton.textContent = isDark ? "☀️" : "🌙";
    });
  }

  // Populate data
  populateTable();
  drawChart();
});
