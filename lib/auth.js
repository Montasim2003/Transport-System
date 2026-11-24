import { supabase } from './supabase';

// ১. স্টুডেন্ট ইমেইল (অথবা ভার্সিটি ID) ও পাসওয়ার্ড দিয়ে লগইন
export async function loginUser(emailOrId, password) {
    const input = emailOrId.trim();

    // demo
    // ভবিষ্যতে ভার্সিটির সেন্ট্রাল লগইন API পেলে এই অংশটি পরিবর্তন করবে
    const isEmail = input.includes('@');

    let query = supabase.from('users').select('*').eq('password', password.trim());

    if (isEmail) {
        query = query.eq('email', input.toLowerCase());
    } else {
        query = query.eq('uni_id', input.toUpperCase());
    }

    const { data, error } = await query.single();

    if (error || !data) {
        return { success: false, message: 'ভুল স্টুডেন্ট ইমেইল অথবা পাসওয়ার্ড দিয়েছ!' };
    }

    return { success: true, user: data };
    // demo end
}

// ২. ৮-ডিজিট পেমেন্ট ভেরিফিকেশন কোড যাচাইসহ নিরাপদ রেজিস্ট্রেশন
export async function registerStudent({ name, uniId, email, paymentCode, password }) {
    const cleanName = name.trim();
    const cleanId = uniId.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = paymentCode.trim();
    const cleanPass = password.trim();

    // ইমেইল ফরম্যাট যাচাই
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return { success: false, message: 'সঠিক স্টুডেন্ট ইমেইল ঠিকানা দাও।' };
    }

    // ৮-ডিজিট সংখ্যা কি না তা যাচাই
    if (!/^\d{8}$/.test(cleanCode)) {
        return { success: false, message: 'পেমেন্ট ভেরিফিকেশন কোডটি অবশ্যই ৮ সংখ্যার হতে হবে!' };
    }

    if (cleanPass.length < 4) {
        return { success: false, message: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।' };
    }

    // demo
    // ভবিষ্যতে ভার্সিটির একাউন্টস অফিসের পেমেন্ট API-এর সাথে এই অংশটি যুক্ত হবে

    // ক) ৮-ডিজিট কোড ও স্টুডেন্ট আইডি ডাটাবেসে আছে কি না এবং অব্যবহৃত কি না তা চেক
    const { data: codeRecord, error: codeError } = await supabase
        .from('payment_codes')
        .select('*')
        .eq('code', cleanCode)
        .eq('student_uni_id', cleanId)
        .single();

    if (codeError || !codeRecord) {
        return {
            success: false,
            message: 'অবৈধ কোড! এই ৮-ডিজিট কোডটি তোমার Student ID-এর সাথে মিলছে না।',
        };
    }

    if (codeRecord.is_used) {
        return {
            success: false,
            message: 'এই ৮-ডিজিট পেমেন্ট কোডটি ইতিমধ্যে ব্যবহার করা হয়ে গেছে!',
        };
    }

    // খ) আগে থেকেই এই ইমেইল বা আইডি দিয়ে অ্যাকাউন্ট খোলা আছে কি না চেক
    const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .or(`uni_id.eq.${cleanId},email.eq.${cleanEmail}`)
        .maybeSingle();

    if (existingUser) {
        return {
            success: false,
            message: 'এই Student ID বা ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে!',
        };
    }

    // গ) নতুন স্টুডেন্ট অ্যাকাউন্ট তৈরি করা
    const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
            uni_id: cleanId,
            name: cleanName,
            email: cleanEmail,
            password: cleanPass,
            role: 'student',
        })
        .select()
        .single();

    if (insertError || !newUser) {
        return { success: false, message: 'রেজিস্ট্রেশন সম্পন্ন হয়নি, আবার চেষ্টা করো।' };
    }

    // ঘ) কোডটিকে ব্যবহৃত (is_used = true) হিসেবে লক করে দেওয়া, যাতে কেউ পুনরায় ব্যবহার করতে না পারে
    await supabase.from('payment_codes').update({ is_used: true }).eq('id', codeRecord.id);

    return { success: true, user: newUser };
    // demo end
}