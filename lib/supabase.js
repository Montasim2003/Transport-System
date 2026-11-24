import { createClient } from '@supabase/supabase-js';

// অফলাইন APK ডেমোর জন্য true রাখো, আর আসল Supabase ক্লাউড ডাটাবেস চালাতে false করে দাও
const OFFLINE_MODE = false;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const realSupabase =
    supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// --- অফলাইন ডেমো অ্যাপের জন্য বিল্ট-ইন লোকাল ডাটাবেস ইঞ্জিন ---
const STORAGE_KEY = 'uni_transport_offline_db_v3';

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

function getInitialData() {
    const today = getTodayStr();
    return {
        routes: [
            {
                id: 1,
                route_name: 'Uttara Route',
                stoppages: ['Campus', 'Ashulia', 'Dhour', 'House Building', 'Uttara Sector-7'],
            },
            {
                id: 2,
                route_name: 'Mirpur Route',
                stoppages: ['Campus', 'Birulia', 'Mirpur-1', 'Mirpur-10', 'Kazipara'],
            },
            {
                id: 3,
                route_name: 'Dhanmondi Route',
                stoppages: ['Campus', 'Gabtoli', 'Shyamoli', 'Asad Gate', 'Dhanmondi-27'],
            },
            {
                id: 4,
                route_name: 'Savar Route',
                stoppages: ['Campus', 'Khagan', 'Jahangirnagar Gate', 'Savar Bazar'],
            },
        ],
        users: [
            {
                id: 1,
                uni_id: 'STU-101',
                name: 'Jubair',
                email: 'jubair@diu.edu.bd',
                password: '1234',
                role: 'student',
                selected_route_id: 1,
                selected_time: '08:30:00',
            },
            {
                id: 2,
                uni_id: 'STU-102',
                name: 'Montasim',
                email: 'montasim@diu.edu.bd',
                password: '1234',
                role: 'student',
                selected_route_id: 2,
                selected_time: '08:30:00',
            },
            {
                id: 3,
                uni_id: 'DRV-01',
                name: 'Abdul Karim',
                email: 'karim.driver@uni.edu.bd',
                password: '1234',
                role: 'driver',
                phone: '01711-223344',
                license_no: 'DL-DHK-2021-884920',
                address: 'জিরাবো, আশুলিয়া, সাভার, ঢাকা',
                helper_name: 'মোঃ সুমন মিয়া',
                helper_phone: '01812-556677',
            },
            {
                id: 4,
                uni_id: 'DRV-02',
                name: 'Abdur Rahim',
                email: 'rahim.driver@uni.edu.bd',
                password: '1234',
                role: 'driver',
                phone: '01715-667788',
                license_no: 'DL-DHK-2020-552190',
                address: 'মিরপুর-১০, সেনপাড়া পর্বতা, ঢাকা',
                helper_name: 'মোঃ রাকিব হাসান',
                helper_phone: '01911-334455',
            },
            {
                id: 5,
                uni_id: 'CON-01',
                name: 'Transport Controller',
                email: 'controller@uni.edu.bd',
                password: '1234',
                role: 'controller',
            },
            {
                id: 6,
                uni_id: 'ADM-01',
                name: 'Head Transport Admin',
                email: 'admin@uni.edu.bd',
                password: '1234',
                role: 'admin',
            },
            {
                id: 7,
                uni_id: 'DRV-03',
                name: 'Rafiqul Islam',
                email: 'rafiq.driver@uni.edu.bd',
                password: '1234',
                role: 'driver',
                phone: '01611-998877',
                license_no: 'DL-DHK-2022-331045',
                address: 'গাবতলী, মাজার রোড, ঢাকা',
                helper_name: 'মোঃ জাহিদুল ইসলাম',
                helper_phone: '01515-443322',
            },
        ],
        buses: [
            {
                id: 1,
                bus_number: 'Bus-01',
                total_seats: 40,
                driver_id: 3,
                route_id: 1,
                current_lat: 23.8768,
                current_lng: 90.3201,
                is_active: true,
            },
            {
                id: 2,
                bus_number: 'Bus-02',
                total_seats: 40,
                driver_id: 4,
                route_id: 2,
                current_lat: 23.8069,
                current_lng: 90.3687,
                is_active: false,
            },
            {
                id: 3,
                bus_number: 'Bus-03',
                total_seats: 40,
                driver_id: 7,
                route_id: 3,
                current_lat: 23.7461,
                current_lng: 90.3742,
                is_active: false,
            },
            {
                id: 4,
                bus_number: 'Bus-04',
                total_seats: 40,
                driver_id: null,
                route_id: 4,
                current_lat: 23.8583,
                current_lng: 90.2667,
                is_active: false,
            },
        ],
        schedules: [
            { id: 1, bus_id: 1, route_id: 1, departure_time: '08:30:00' },
            { id: 2, bus_id: 1, route_id: 1, departure_time: '13:30:00' },
            { id: 3, bus_id: 1, route_id: 1, departure_time: '16:30:00' },
            { id: 4, bus_id: 2, route_id: 2, departure_time: '08:30:00' },
            { id: 5, bus_id: 2, route_id: 2, departure_time: '14:00:00' },
            { id: 6, bus_id: 3, route_id: 3, departure_time: '09:00:00' },
            { id: 7, bus_id: 4, route_id: 4, departure_time: '08:45:00' },
        ],
        bookings: [
            { id: 1, student_id: 2, schedule_id: 1, seat_number: 3, booking_date: today, status: 'confirmed' },
            { id: 2, student_id: 2, schedule_id: 1, seat_number: 4, booking_date: today, status: 'confirmed' },
            { id: 3, student_id: 2, schedule_id: 1, seat_number: 10, booking_date: today, status: 'confirmed' },
        ],
        payment_codes: [
            { id: 1, code: '20261001', student_uni_id: 'STU-104', is_used: false },
            { id: 2, code: '20261002', student_uni_id: 'STU-105', is_used: false },
            { id: 3, code: '20261003', student_uni_id: 'STU-106', is_used: false },
            { id: 4, code: '20261004', student_uni_id: 'STU-107', is_used: false },
            { id: 5, code: '20261005', student_uni_id: 'STU-108', is_used: false },
        ],
    };
}

function loadDB() {
    if (typeof window === 'undefined') return getInitialData();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        const seed = getInitialData();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
    }
    return JSON.parse(raw);
}

function saveDB(db) {
    if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
}

function attachRelations(table, rows, db, selectCols) {
    if (!selectCols || !selectCols.includes('(')) return rows;
    return rows.map((row) => {
        const enriched = { ...row };
        if (table === 'schedules') {
            if (selectCols.includes('buses')) {
                enriched.buses = db.buses.find((b) => b.id === row.bus_id) || null;
            }
            if (selectCols.includes('routes')) {
                enriched.routes = db.routes.find((r) => r.id === row.route_id) || null;
            }
        }
        if (table === 'buses') {
            if (selectCols.includes('routes')) {
                enriched.routes = db.routes.find((r) => r.id === row.route_id) || null;
            }
            if (selectCols.includes('users')) {
                enriched.users = db.users.find((u) => u.id === row.driver_id) || null;
            }
        }
        return enriched;
    });
}

class OfflineQueryBuilder {
    constructor(table) {
        this.table = table;
        this.op = 'select';
        this.selectCols = '*';
        this.selectOpts = {};
        this.filters = [];
        this.orExpr = null;
        this.orderCol = null;
        this.orderAsc = true;
        this.singleMode = null;
        this.payload = null;
    }

    select(cols = '*', opts = {}) {
        if (this.op !== 'insert' && this.op !== 'update') {
            this.op = 'select';
        }
        this.selectCols = cols;
        this.selectOpts = opts || {};
        return this;
    }

    insert(data) {
        this.op = 'insert';
        this.payload = Array.isArray(data) ? data : [data];
        return this;
    }

    update(patch) {
        this.op = 'update';
        this.payload = patch;
        return this;
    }

    delete() {
        this.op = 'delete';
        return this;
    }

    eq(col, val) {
        this.filters.push({ type: 'eq', col, val });
        return this;
    }

    in(col, arr) {
        this.filters.push({ type: 'in', col, arr });
        return this;
    }

    or(expr) {
        this.orExpr = expr;
        return this;
    }

    order(col, opts = { ascending: true }) {
        this.orderCol = col;
        this.orderAsc = opts?.ascending !== false;
        return this;
    }

    single() {
        this.singleMode = 'single';
        return this;
    }

    maybeSingle() {
        this.singleMode = 'maybeSingle';
        return this;
    }

    _matchRow(row) {
        for (const f of this.filters) {
            if (f.type === 'eq' && row[f.col] !== f.val) return false;
            if (f.type === 'in' && !f.arr.includes(row[f.col])) return false;
        }
        if (this.orExpr) {
            const parts = this.orExpr.split(',');
            const anyMatch = parts.some((part) => {
                const [col, op, ...rest] = part.split('.');
                const val = rest.join('.');
                return op === 'eq' && String(row[col]) === String(val);
            });
            if (!anyMatch) return false;
        }
        return true;
    }

    _execute() {
        const db = loadDB();
        const rows = db[this.table] || [];

        if (this.op === 'insert') {
            const inserted = [];
            for (const item of this.payload) {
                if (this.table === 'bookings') {
                    const dup = rows.find(
                        (b) =>
                            b.schedule_id === item.schedule_id &&
                            b.seat_number === item.seat_number &&
                            b.booking_date === item.booking_date
                    );
                    if (dup) {
                        return { data: null, error: { message: 'Seat already booked' } };
                    }
                }
                const nextId = rows.length > 0 ? Math.max(...rows.map((r) => Number(r.id) || 0)) + 1 : 1;
                const newRow = { id: nextId, ...item };
                rows.push(newRow);
                inserted.push(newRow);
            }
            db[this.table] = rows;
            saveDB(db);

            if (this.singleMode) {
                return { data: inserted[0] || null, error: null };
            }
            return { data: inserted, error: null };
        }

        if (this.op === 'update') {
            const updated = [];
            db[this.table] = rows.map((r) => {
                if (this._matchRow(r)) {
                    const next = { ...r, ...this.payload };
                    updated.push(next);
                    return next;
                }
                return r;
            });
            saveDB(db);
            return { data: updated, error: null };
        }

        if (this.op === 'delete') {
            db[this.table] = rows.filter((r) => !this._matchRow(r));
            saveDB(db);
            return { data: null, error: null };
        }

        let result = rows.filter((r) => this._matchRow(r));
        result = attachRelations(this.table, result, db, this.selectCols);

        if (this.orderCol) {
            result.sort((a, b) => {
                if (a[this.orderCol] < b[this.orderCol]) return this.orderAsc ? -1 : 1;
                if (a[this.orderCol] > b[this.orderCol]) return this.orderAsc ? 1 : -1;
                return 0;
            });
        }

        if (this.selectOpts.count === 'exact' && this.selectOpts.head) {
            return { count: result.length, data: null, error: null };
        }

        if (this.singleMode === 'single') {
            if (result.length === 0) {
                return { data: null, error: { message: 'No rows found' } };
            }
            return { data: result[0], error: null };
        }

        if (this.singleMode === 'maybeSingle') {
            return { data: result[0] || null, error: null };
        }

        return { data: result, error: null };
    }

    then(resolve, reject) {
        try {
            resolve(this._execute());
        } catch (err) {
            if (reject) reject(err);
        }
    }
}

const offlineSupabase = {
    from(table) {
        return new OfflineQueryBuilder(table);
    },
};

export const supabase = OFFLINE_MODE ? offlineSupabase : realSupabase;