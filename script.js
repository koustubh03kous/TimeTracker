let selectedDate = new Date().toISOString().split('T')[0];
let projects = [];
let templates = [];
let timeBlocks = {};
let dailyReflection = '';
let selectedBlocks = [];
let viewMode = 'daily'; // 'daily' or 'weekly'

const timeSlots = (() => {
    const slots = [];
    for (let h = 6; h < 24; h++) {
        slots.push(`${h.toString().padStart(2, '0')}:00`);
        if (h < 23) slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
})();

const colors = ['color-blue', 'color-green', 'color-purple', 'color-orange', 'color-pink', 'color-indigo', 'color-teal', 'color-amber', 'color-red', 'color-cyan'];

// --- Utility Functions ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function getProjectColor(proj) {
    if (!proj) return '';
    const projectIndex = projects.indexOf(proj);
    if (projectIndex === -1) return ''; // Project not in the list
    return colors[projectIndex % colors.length];
}

// --- Render Functions ---
async function renderGrid() {
    const body = document.getElementById('timeGridBody');
    body.innerHTML = '';

    timeSlots.forEach(time => {
        const block = timeBlocks[time] || { p: '', a: '', pr: '', e: 3, d: '' };
        const isSelected = selectedBlocks.includes(time);
        const row = document.createElement('div');
        row.className = 'time-row' + (isSelected ? ' selected' : '');
        row.setAttribute('data-time', time);
        row.innerHTML = `
            <div class="cell header-cell-checkbox">
                <input type="checkbox" ${isSelected ? 'checked' : ''} data-time="${time}">
            </div>
            <div class="cell time">${time}</div>
            <div class="cell input">
                <textarea data-field="p" placeholder="Plan...">${block.p || ''}</textarea>
            </div>
            <div class="cell input">
                <textarea data-field="a" placeholder="Reality...">${block.a || ''}</textarea>
            </div>
            <div class="cell project">
                <div class="project-input-row">
                    <div class="project-dot ${getProjectColor(block.pr)}"></div>
                    <input type="text" list="projectsDatalist" data-field="pr" value="${block.pr || ''}" placeholder="Tag">
                    <select data-field="e" title="Energy">
                        <option value="1" ${block.e == 1 ? 'selected' : ''}>⚡1</option>
                        <option value="2" ${block.e == 2 ? 'selected' : ''}>⚡2</option>
                        <option value="3" ${block.e == 3 ? 'selected' : ''}>⚡3</option>
                        <option value="4" ${block.e == 4 ? 'selected' : ''}>⚡4</option>
                        <option value="5" ${block.e == 5 ? 'selected' : ''}>⚡5</option>
                    </select>
                </div>
                ${block.a && !block.p ? `
                <input type="text" class="distraction-input" data-field="d" value="${block.d || ''}" placeholder="Why deviated?">
                ` : ''}
            </div>
        `;
        body.appendChild(row);
    });

    // Add event listeners for the dynamically created elements
    body.querySelectorAll('textarea[data-field], input[data-field], select[data-field]').forEach(input => {
        input.addEventListener('change', (e) => {
            const time = e.target.closest('.time-row').dataset.time;
            const field = e.target.dataset.field;
            updateBlock(time, field, e.target.value);
        });
    });

    body.querySelectorAll('input[type="checkbox"][data-time]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            toggleBlockSelection(e.target.dataset.time);
        });
    });

    updateProjectsDatalist();
}

function updateProjectsDatalist() {
    const datalist = document.getElementById('projectsDatalist');
    datalist.innerHTML = '';
    projects.forEach(p => {
        const option = document.createElement('option');
        option.value = p;
        datalist.appendChild(option);
    });
}

async function renderTemplates() {
    const grid = document.getElementById('templateGrid');
    grid.innerHTML = '';

    // Templates are fetched in loadData, ensure they are up-to-date
    const { data: fetchedTemplates, error: templatesError } = await supabase.from('templates').select('*');
    if (templatesError) {
        console.error('Error re-fetching templates for rendering:', templatesError);
    } else if (fetchedTemplates) {
        templates = fetchedTemplates.map(t => ({ name: t.name, data: t.data, created: t.created_at }));
    }

    if (templates.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #9ca3af; padding: 20px;">No templates saved yet</div>';
        return;
    }
    templates.forEach((t, i) => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.innerHTML = `
            <div class="template-header">
                <div>
                    <div class="template-name">${t.name}</div>
                    <div class="template-date">${new Date(t.created).toLocaleDateString()}</div>
                </div>
                <div class="template-actions">
                    <button class="primary load-template-btn" data-index="${i}" style="padding: 4px 8px; font-size: 11px;">Load</button>
                    <button class="warning delete-template-btn" data-index="${i}" style="padding: 4px 8px; font-size: 11px;">Delete</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll('.load-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => loadTemplate(parseInt(e.target.dataset.index)));
    });
    grid.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteTemplate(parseInt(e.target.dataset.index)));
    });
}

// --- Core Data Logic (Supabase Integrated) ---
async function loadData() {
    // Load projects from Supabase
    const { data: fetchedProjects, error: projectsError } = await supabase.from('projects').select('name');
    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    } else if (fetchedProjects) {
        projects = fetchedProjects.map(p => p.name);
    }

    // Load templates from Supabase
    const { data: fetchedTemplates, error: templatesError } = await supabase.from('templates').select('*');
    if (templatesError) {
        console.error('Error fetching templates:', templatesError);
    } else if (fetchedTemplates) {
        templates = fetchedTemplates.map(t => ({ name: t.name, data: t.data, created: t.created_at }));
    }

    // Load reflection for the selected date from Supabase
    const { data: fetchedReflection, error: reflectionError } = await supabase
        .from('reflections')
        .select('content')
        .eq('date', selectedDate)
        .single();
    if (reflectionError && reflectionError.code !== 'PGRST116') { // PGRST116 is 'No rows found'
        console.error('Error fetching reflection:', reflectionError);
    } else if (fetchedReflection) {
        dailyReflection = fetchedReflection.content;
        document.getElementById('reflectionText').value = dailyReflection;
    } else {
        dailyReflection = '';
        document.getElementById('reflectionText').value = '';
    }

    // Load time blocks for the selected date from Supabase
    const { data: fetchedTimeBlocks, error: timeBlocksError } = await supabase
        .from('time_entries')
        .select('time_slot, planned, actual, project_tag, energy_level, distraction_reason')
        .eq('date', selectedDate);

    if (timeBlocksError) {
        console.error('Error fetching time blocks:', timeBlocksError);
    } else if (fetchedTimeBlocks && fetchedTimeBlocks.length > 0) {
        timeBlocks = {};
        fetchedTimeBlocks.forEach(entry => {
            timeBlocks[entry.time_slot] = {
                p: entry.planned || '',
                a: entry.actual || '',
                pr: entry.project_tag || '',
                e: entry.energy_level || 3,
                d: entry.distraction_reason || ''
            };
        });
    } else {
        timeBlocks = {};
        timeSlots.forEach(s => {
            timeBlocks[s] = { p: '', a: '', pr: '', e: 3, d: '' };
        });
    }
    renderGrid();
    updateSummary();
    renderTemplates();
    updateProjectsDatalist(); // Ensure datalist is updated after projects are loaded
}

async function saveData() {
    dailyReflection = document.getElementById('reflectionText').value;

    // Save reflection to Supabase
    const { error: reflectionUpsertError } = await supabase
        .from('reflections')
        .upsert({ date: selectedDate, content: dailyReflection }, { onConflict: 'date' });
    if (reflectionUpsertError) console.error('Error saving reflection:', reflectionUpsertError);

    // Save time blocks to Supabase
    const timeEntriesToUpsert = Object.entries(timeBlocks).map(([time_slot, data]) => ({
        date: selectedDate,
        time_slot,
        planned: data.p,
        actual: data.a,
        project_tag: data.pr,
        energy_level: data.e,
        distraction_reason: data.d
    }));
    const { error: timeBlocksUpsertError } = await supabase.from('time_entries').upsert(timeEntriesToUpsert, { onConflict: 'date,time_slot' });
    if (timeBlocksUpsertError) console.error('Error saving time blocks:', timeBlocksUpsertError);

    // Save projects to Supabase (only unique new ones)
    const existingProjects = (await supabase.from('projects').select('name')).data.map(p => p.name);
    const newProjects = projects.filter(p => !existingProjects.includes(p));
    if (newProjects.length > 0) {
        const projectsToUpsert = newProjects.map(name => ({ name }));
        const { error: projectsUpsertError } = await supabase.from('projects').upsert(projectsToUpsert, { onConflict: 'name' });
        if (projectsUpsertError) console.error('Error saving projects:', projectsUpsertError);
    }

    // Templates saving is handled by saveTemplate() now

    showToast('✓ Data saved successfully!');
}

async function saveTemplate() {
    const name = prompt('Enter template name:');
    if (name) {
        const { error } = await supabase.from('templates').upsert({ name, data: JSON.parse(JSON.stringify(timeBlocks)), created_at: new Date().toISOString() }, { onConflict: 'name' });
        if (error) {
            console.error('Error saving template:', error);
            showToast('❌ Template save failed!');
        } else {
            await loadData(); // Re-fetch all data including templates to update the UI correctly
            showToast('✓ Template saved!');
        }
    }
}

function loadTemplate(index) {
    timeBlocks = JSON.parse(JSON.stringify(templates[index].data));
    renderGrid();
    updateSummary();
    showToast('✓ Template loaded!');
}

async function deleteTemplate(index) {
    if (confirm('Delete this template?')) {
        const templateToDelete = templates[index];
        const { error } = await supabase.from('templates').delete().eq('name', templateToDelete.name);

        if (error) {
            console.error('Error deleting template:', error);
            showToast('❌ Template deletion failed!');
        } else {
            await loadData(); // Re-fetch all data including templates to update the UI correctly
            showToast('✓ Template deleted!');
        }
    }
}

// --- UI Event Handlers ---
function changeDate(days) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    selectedDate = d.toISOString().split('T')[0];
    document.getElementById('dateInput').value = selectedDate;
    loadData();
}

function onDateChange(event) {
    selectedDate = event.target.value;
    loadData();
}

function goToToday() {
    selectedDate = new Date().toISOString().split('T')[0];
    document.getElementById('dateInput').value = selectedDate;
    loadData();
}

async function copyYesterday() {
    const y = new Date(selectedDate);
    y.setDate(y.getDate() - 1);
    const yesterdayDate = y.toISOString().split('T')[0];

    const { data: yesterdayBlocks, error } = await supabase
        .from('time_entries')
        .select('time_slot, actual, project_tag')
        .eq('date', yesterdayDate);

    if (error) {
        console.error('Error fetching yesterday\'s data:', error);
        showToast('❌ Error fetching yesterday\'s data');
        return;
    }

    if (yesterdayBlocks && yesterdayBlocks.length > 0) {
        timeBlocks = {}; // Clear current day's timeBlocks
        timeSlots.forEach(s => {
            timeBlocks[s] = { p: '', a: '', pr: '', e: 3, d: '' }; // Initialize with empty
        });

        yesterdayBlocks.forEach(entry => {
            if (timeBlocks[entry.time_slot]) {
                timeBlocks[entry.time_slot].p = entry.actual || ''; // Planned for today = Actual from yesterday
                timeBlocks[entry.time_slot].pr = entry.project_tag || '';
            }
        });
        renderGrid();
        updateSummary();
        showToast('✓ Yesterday\'s actuals copied to today\'s plan!');
    } else {
        showToast('❌ No data for yesterday');
    }
}

function toggleBlockSelection(time) {
    if (selectedBlocks.includes(time)) {
        selectedBlocks = selectedBlocks.filter(t => t !== time);
    } else {
        selectedBlocks.push(time);
    }
    document.getElementById('selectedCount').textContent = selectedBlocks.length;
    document.getElementById('bulkPanel').classList.toggle('hidden', selectedBlocks.length === 0);
    renderGrid(); // Re-render to update checkbox states and row highlighting
}

function clearSelection() {
    selectedBlocks = [];
    document.getElementById('bulkPanel').classList.add('hidden');
    renderGrid();
}

function applyBulkProject() {
    const proj = document.getElementById('bulkProjectInput').value;
    if (proj && selectedBlocks.length > 0) {
        selectedBlocks.forEach(time => {
            updateBlock(time, 'pr', proj);
        });
        if (!projects.includes(proj)) {
            projects.push(proj);
        }
        clearSelection();
        // renderGrid and updateSummary are called by updateBlock
        showToast(`✓ Applied "${proj}" to ${selectedBlocks.length} blocks`);
    }
}

async function updateSummary() {
    const sum = {};
    let totalPlannedHours = 0;
    let totalActualHours = 0;
    let plannedBlocks = 0;
    let completedBlocks = 0;
    let energySum = 0;
    let energyCount = 0;

    Object.entries(timeBlocks).forEach(([_, d]) => {
        if (d.p) plannedBlocks++;
        if (d.a) completedBlocks++;
        if (d.e) {
            energySum += d.e;
            energyCount++;
        }
        if (d.pr) {
            if (!sum[d.pr]) sum[d.pr] = { p: 0, a: 0 };
            if (d.p) { sum[d.pr].p += 0.5; totalPlannedHours += 0.5; }
            if (d.a) { sum[d.pr].a += 0.5; totalActualHours += 0.5; }
        }
    });

    const drift = totalActualHours - totalPlannedHours;
    const efficiency = plannedBlocks > 0 ? Math.round((completedBlocks / plannedBlocks) * 100) : 0;
    const avgEnergy = energyCount > 0 ? (energySum / energyCount).toFixed(1) : 0;

    document.getElementById('totalPlanned').textContent = totalPlannedHours + 'h';
    document.getElementById('totalActual').textContent = totalActualHours + 'h';
    document.getElementById('totalDrift').textContent = (drift >= 0 ? '+' : '') + drift + 'h';
    document.getElementById('totalDrift').closest('.summary-box').style.borderColor = drift >= 0 ? '#f59e0b' : '#8b5cf6'; // Orange or Purple border
    document.getElementById('totalDrift').style.color = drift >= 0 ? '#fbbf24' : '#a78bfa'; // Yellow/Orange or Purple text
    document.getElementById('efficiency').textContent = efficiency + '%';
    document.getElementById('avgEnergy').textContent = avgEnergy;

    const projectList = document.getElementById('projectList');
    projectList.innerHTML = '';
    Object.entries(sum).forEach(([pr, t]) => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.innerHTML = `
            <div>
                <span class="project-dot ${getProjectColor(pr)}"></span> <strong>${pr}</strong>
            </div>
            <div style="font-family: monospace; font-size: 13px;">
                <span style="color: #60a5fa">Plan: ${t.p}h</span> | <span style="color: #34d399">Real: ${t.a}h</span> | <span style="color: ${t.a >= t.p ? '#fbbf24' : '#a78bfa'}"> ${t.a >= t.p ? '+' : ''}${(t.a - t.p).toFixed(1)}h </span>
            </div>
        `;
        projectList.appendChild(item);
    });

    if (viewMode === 'weekly') loadWeeklySummary();
}

async function loadWeeklySummary() {
    const weekData = {};
    const projectTotals = {};
    const today = new Date(selectedDate); // Use selectedDate for consistency
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dk = d.toISOString().split('T')[0];

        const { data: blocks, error } = await supabase
            .from('time_entries')
            .select('planned, actual, project_tag')
            .eq('date', dk);

        if (error) {
            console.error(`Error fetching data for ${dk}:`, error);
            continue;
        }

        if (blocks && blocks.length > 0) {
            let dp = 0, da = 0;
            blocks.forEach(b => {
                if (b.project_tag) {
                    if (!projectTotals[b.project_tag]) projectTotals[b.project_tag] = { p: 0, a: 0 };
                    if (b.planned) {
                        projectTotals[b.project_tag].p += 0.5;
                        dp += 0.5;
                    }
                    if (b.actual) {
                        projectTotals[b.project_tag].a += 0.5;
                        da += 0.5;
                    }
                }
            });
            weekData[dk] = { p: dp, a: da };
        } else {
            weekData[dk] = { p: 0, a: 0 };
        }
    }

    const grid = document.getElementById('weeklyGrid');
    grid.innerHTML = '';
    Object.entries(weekData).reverse().forEach(([date, data]) => {
        const day = document.createElement('div');
        day.className = 'day-box';
        const d = new Date(date);
        day.innerHTML = `
            <div class="day-name">${d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div class="day-stat" style="color: #60a5fa">P: ${data.p}h</div>
            <div class="day-stat" style="color: #34d399">A: ${data.a}h</div>
        `;
        grid.appendChild(day);
    });

    const list = document.getElementById('weeklyProjects');
    list.innerHTML = '';
    Object.entries(projectTotals).forEach(([pr, t]) => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.innerHTML = `
            <div>
                <span class="project-dot ${getProjectColor(pr)}"></span> <strong>${pr}</strong>
            </div>
            <div style="font-family: monospace; font-size: 13px;">
                <span style="color: #60a5fa">Plan: ${t.p}h</span> | <span style="color: #34d399">Real: ${t.a}h</span> | <span style="color: ${t.a >= t.p ? '#fbbf24' : '#a78bfa'}"> ${t.a >= t.p ? '+' : ''}${(t.a - t.p).toFixed(1)}h </span>
            </div>
        `;
        list.appendChild(item);
    });
}

// --- Import/Export Functions (Supabase Integrated) ---
async function exportJSON() {
    const allData = { projects: [], templates: [], entries: {} };

    // Fetch all projects
    const { data: fetchedProjects, error: projectsError } = await supabase.from('projects').select('name');
    if (projectsError) console.error('Error fetching projects for export:', projectsError);
    else allData.projects = fetchedProjects.map(p => p.name);

    // Fetch all templates
    const { data: fetchedTemplates, error: templatesError } = await supabase.from('templates').select('*');
    if (templatesError) console.error('Error fetching templates for export:', templatesError);
    else allData.templates = fetchedTemplates.map(t => ({ name: t.name, data: t.data, created: t.created_at }));

    // Fetch all time entries and reflections for the last 90 days
    const today = new Date();
    const dateRange = [];
    for (let i = 0; i < 90; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dateRange.push(d.toISOString().split('T')[0]);
    }

    const { data: allTimeBlocks, error: allTimeBlocksError } = await supabase
        .from('time_entries')
        .select('date, time_slot, planned, actual, project_tag, energy_level, distraction_reason')
        .in('date', dateRange);
    
    const { data: allReflections, error: allReflectionsError } = await supabase
        .from('reflections')
        .select('date, content')
        .in('date', dateRange);

    if (allTimeBlocksError) console.error('Error fetching all time blocks for export:', allTimeBlocksError);
    if (allReflectionsError) console.error('Error fetching all reflections for export:', allReflectionsError);

    if (allTimeBlocks) {
        allTimeBlocks.forEach(entry => {
            if (!allData.entries[entry.date]) {
                allData.entries[entry.date] = { blocks: {}, reflection: '' };
            }
            allData.entries[entry.date].blocks[entry.time_slot] = {
                p: entry.planned || '',
                a: entry.actual || '',
                pr: entry.project_tag || '',
                e: entry.energy_level || 3,
                d: entry.distraction_reason || ''
            };
        });
    }
    if (allReflections) {
        allReflections.forEach(entry => {
            if (!allData.entries[entry.date]) {
                allData.entries[entry.date] = { blocks: {}, reflection: '' };
            }
            allData.entries[entry.date].reflection = entry.content || '';
        });
    }

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-diary-pro-${selectedDate}.json`;
    a.click();
    showToast('✓ JSON exported (90 days)!');
}

async function exportCSV() {
    let csv = 'Date,Time,Planned,Actual,Project,Energy,Distraction\n';

    const today = new Date();
    const dateRange = [];
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        dateRange.push(d.toISOString().split('T')[0]);
    }

    const { data: allTimeBlocks, error: allTimeBlocksError } = await supabase
        .from('time_entries')
        .select('date, time_slot, planned, actual, project_tag, energy_level, distraction_reason')
        .in('date', dateRange);

    if (allTimeBlocksError) {
        console.error('Error fetching all time blocks for CSV export:', allTimeBlocksError);
        showToast('❌ CSV export failed due to data fetching error');
        return;
    }

    if (allTimeBlocks) {
        // Group blocks by date and then by time_slot
        const groupedBlocks = {};
        allTimeBlocks.forEach(entry => {
            if (!groupedBlocks[entry.date]) {
                groupedBlocks[entry.date] = {};
            }
            groupedBlocks[entry.date][entry.time_slot] = entry;
        });

        // Sort dates in ascending order for CSV output
        const sortedDates = Object.keys(groupedBlocks).sort();

        sortedDates.forEach(date => {
            timeSlots.forEach(time => {
                const b = groupedBlocks[date][time];
                if (b && (b.planned || b.actual)) {
                    csv += `${date},${time},"${b.planned || ''}","${b.actual || ''}","${b.project_tag || ''}",${b.energy_level || 3},"${b.distraction_reason || ''}"\n`;
                }
            });
        });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-diary-pro-${selectedDate}.csv`;
    a.click();
    showToast('✓ CSV exported (30 days)!');
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) { // Make onload async to await Supabase calls
        try {
            const content = e.target.result;
            const ext = file.name.split('.').pop().toLowerCase();
            if (ext === 'json') {
                await importJSON(content); // Await the async importJSON
            } else if (ext === 'csv') {
                await importCSV(content); // Await the async importCSV
            } else {
                showToast('❌ Unsupported file');
            }
        } catch (error) {
            console.error(error);
            showToast('❌ Import failed');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function importJSON(content) {
    try {
        const data = JSON.parse(content);
        let count = 0;

        // Import projects
        if (data.projects && data.projects.length > 0) {
            const projectsToUpsert = data.projects.map(name => ({ name }));
            const { error } = await supabase.from('projects').upsert(projectsToUpsert, { onConflict: 'name' });
            if (error) console.error('Error importing projects:', error);
            else projects = [...new Set([...projects, ...data.projects])]; // Update local projects array
        }

        // Import templates
        if (data.templates && data.templates.length > 0) {
            const templatesToUpsert = data.templates.map(t => ({
                name: t.name,
                data: t.data,
                created_at: t.created // Assuming 'created' from export is 'created_at' for Supabase
            }));
            const { error } = await supabase.from('templates').upsert(templatesToUpsert, { onConflict: 'name' });
            if (error) console.error('Error importing templates:', error);
            else { // Re-fetch templates to ensure UI consistency
                const { data: fetchedTemplates, error: fetchError } = await supabase.from('templates').select('*');
                if (fetchError) console.error('Error re-fetching templates after import:', fetchError);
                else templates = fetchedTemplates.map(t => ({ name: t.name, data: t.data, created: t.created_at }));
            }
        }

        // Import entries (time blocks and reflections)
        if (data.entries) {
            for (const [date, entry] of Object.entries(data.entries)) {
                // Upsert reflection
                if (entry.reflection) {
                    const { error: reflectionError } = await supabase
                        .from('reflections')
                        .upsert({ date, content: entry.reflection }, { onConflict: 'date' });
                    if (reflectionError) console.error(`Error importing reflection for ${date}:`, reflectionError);
                }

                // Upsert time blocks
                if (entry.blocks && Object.keys(entry.blocks).length > 0) {
                    const timeEntriesToUpsert = Object.entries(entry.blocks).map(([time_slot, block]) => ({
                        date,
                        time_slot,
                        planned: block.p,
                        actual: block.a,
                        project_tag: block.pr,
                        energy_level: block.e,
                        distraction_reason: block.d
                    }));
                    const { error: timeBlocksError } = await supabase.from('time_entries').upsert(timeEntriesToUpsert, { onConflict: 'date,time_slot' });
                    if (timeBlocksError) console.error(`Error importing time blocks for ${date}:`, timeBlocksError);
                }
                count++;
            }
        }

        showToast(`✓ Imported ${count} days!`);
        loadData(); // Reload data to ensure UI reflects newly imported data
    } catch (error) {
        console.error(error);
        showToast('❌ JSON parse error');
    }
}

async function importCSV(content) {
    try {
        const lines = content.split('\n'); // Changed to split by newline for CSV
        let count = 0;
        const timeEntriesToUpsert = [];
        const projectsToUpsert = new Set();
        const reflectionsToUpsert = {}; // CSV doesn't typically have reflections per day, but handling if it did

        for (let i = 1; i < lines.length; i++) { // Skip header row
            const line = lines[i].trim();
            if (!line) continue;

            // Regex to handle commas within double quotes
            const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
            if (!matches || matches.length < 7) { // Expect 7 fields
                console.warn(`Skipping malformed CSV line: ${line}`);
                continue;
            }

            const date = matches[0].replace(/"/g, '').trim();
            const time_slot = matches[1].replace(/"/g, '').trim();
            const planned = matches[2].replace(/"/g, '').trim();
            const actual = matches[3].replace(/"/g, '').trim();
            const project_tag = matches[4].replace(/"/g, '').trim();
            const energy_level = matches[5] ? parseInt(matches[5].replace(/"/g, '').trim()) : 3;
            const distraction_reason = matches[6] ? matches[6].replace(/"/g, '').trim() : '';

            timeEntriesToUpsert.push({
                date,
                time_slot,
                planned,
                actual,
                project_tag,
                energy_level,
                distraction_reason
            });

            if (project_tag) projectsToUpsert.add(project_tag);
            // No reflection data in typical CSV, so reflectionsToUpsert won't be used here naturally
            count++;
        }

        // Upsert time entries
        if (timeEntriesToUpsert.length > 0) {
            const { error } = await supabase.from('time_entries').upsert(timeEntriesToUpsert, { onConflict: 'date,time_slot' });
            if (error) console.error('Error importing time entries from CSV:', error);
        }

        // Upsert new projects
        if (projectsToUpsert.size > 0) {
            const newProjectsArray = Array.from(projectsToUpsert).map(name => ({ name }));
            const { error } = await supabase.from('projects').upsert(newProjectsArray, { onConflict: 'name' });
            if (error) console.error('Error importing projects from CSV:', error);
            else projects = [...new Set([...projects, ...Array.from(projectsToUpsert)])]; // Update local projects array
        }

        showToast(`✓ Imported ${count} time entries from CSV!`);
        loadData(); // Reload data to ensure UI reflects newly imported data
    } catch (error) {
        console.error(error);
        showToast('❌ CSV parse error');
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners for Header Buttons
    document.getElementById('dateInput').addEventListener('change', onDateChange);
    document.getElementById('prevDayBtn').addEventListener('click', () => changeDate(-1));
    document.getElementById('nextDayBtn').addEventListener('click', () => changeDate(1));
    document.getElementById('todayBtn').addEventListener('click', goToToday);
    document.getElementById('copyYesterdayBtn').addEventListener('click', copyYesterday);
    document.getElementById('saveBtn').addEventListener('click', saveData);

    // Panel Toggles
    document.getElementById('templatesBtn').addEventListener('click', () => togglePanel('templatesPanel'));
    document.getElementById('summaryBtn').addEventListener('click', () => togglePanel('summaryPanel'));
    document.getElementById('reflectBtn').addEventListener('click', () => togglePanel('reflectionPanel'));

    // Bulk actions
    document.getElementById('selectAllCheckbox').addEventListener('change', toggleSelectAll);
    document.getElementById('applyBulkProjectBtn').addEventListener('click', applyBulkProject);
    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);

    // Export/Import
    document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    // The input[type="file"] has its own onchange listener for handleImport

    // Summary View Mode
    document.getElementById('dailyViewBtn').addEventListener('click', () => setViewMode('daily'));
    document.getElementById('weeklyViewBtn').addEventListener('click', () => setViewMode('weekly'));

    // Initial Load
    document.getElementById('dateInput').value = selectedDate;
    loadData();

    // Auto-save every 30 seconds
    setInterval(() => {
        if (Object.keys(timeBlocks).length > 0 || dailyReflection !== document.getElementById('reflectionText').value) {
            saveData();
        }
    }, 30000);
});

function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.toggle('hidden');
}

function toggleSelectAll(event) {
    const isChecked = event.target.checked;
    selectedBlocks = [];
    if (isChecked) {
        timeSlots.forEach(time => selectedBlocks.push(time));
    }
    document.getElementById('selectedCount').textContent = selectedBlocks.length;
    document.getElementById('bulkPanel').classList.toggle('hidden', selectedBlocks.length === 0);
    renderGrid();
}

// Make updateBlock available globally for event listeners
window.updateBlock = (time, field, value) => {
    if (!timeBlocks[time]) timeBlocks[time] = { p: '', a: '', pr: '', e: 3, d: '' };
    timeBlocks[time][field] = field === 'e' ? parseInt(value) : value;
    updateSummary();
    if (field === 'a' || field === 'p') {
        renderGrid(); // Re-render to show/hide distraction input
    }
};

window.updateProject = (time, value) => {
    if (!timeBlocks[time]) timeBlocks[time] = { p: '', a: '', pr: '', e: 3, d: '' };
    timeBlocks[time].pr = value;
    if (value && !projects.includes(value)) {
        projects.push(value);
        updateProjectsDatalist(); // Update the datalist when a new project is added
    }
    updateSummary();
    renderGrid(); // Re-render to update project dot color
};
