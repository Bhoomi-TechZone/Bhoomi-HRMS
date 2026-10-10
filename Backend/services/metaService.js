const axios = require('axios');
const MetaConfig = require('../models/MetaConfig');
const MetaLead = require('../models/MetaLead');

const BASE_URL = 'https://graph.facebook.com';

// ─── Helper: build Graph API URL ───────────────────────────────────────────
function graphUrl(version, path) {
  return `${BASE_URL}/${version}${path}`;
}

// ─── Fetch all pages the user manages ──────────────────────────────────────
async function getPages(userAccessToken, version = 'v25.0') {
  const url = graphUrl(version, '/me/accounts');
  const resp = await axios.get(url, {
    params: { access_token: userAccessToken, limit: 100 }
  });
  return resp.data.data; // array of { id, name, access_token, category, tasks }
}

// ─── Fetch all lead-gen forms for a page (handles pagination) ──────────────
async function getLeadGenForms(pageId, pageToken, version = 'v25.0') {
  const forms = [];
  let url = graphUrl(version, `/${pageId}/leadgen_forms`);
  let params = { access_token: pageToken, limit: 100, fields: 'id,name,status,locale,platform' };

  while (url) {
    const resp = await axios.get(url, { params });
    if (resp.data.data) forms.push(...resp.data.data);
    url = resp.data.paging && resp.data.paging.next ? resp.data.paging.next : null;
    params = {}; // next URL already contains all query params
  }
  return forms;
}

// ─── Parse raw field_data array into a clean object ────────────────────────
function parseFieldData(fieldData) {
  const result = {
    name: '',
    email: '',
    phone: '',
    city: '',
    businessCategory: '',
    websiteType: ''
  };

  const fieldMap = {
    full_name: 'name',
    name: 'name',
    email: 'email',
    phone: 'phone',
    phone_number: 'phone',
    city: 'city',
    'what_is_your_business_category?': 'businessCategory',
    business_category: 'businessCategory',
    'what_type_of_website_do_you_need?': 'websiteType',
    website_type: 'websiteType'
  };

  for (const field of fieldData) {
    const key = fieldMap[field.name.toLowerCase()];
    if (key && field.values && field.values[0]) {
      result[key] = field.values[0];
    }
  }
  return result;
}

// ─── Fetch leads for a specific form (handles pagination, optional since) ──
async function getFormLeads(formId, pageToken, version = 'v25.0', since = null) {
  const leads = [];
  let url = graphUrl(version, `/${formId}/leads`);
  let params = {
    access_token: pageToken,
    limit: 100,
    fields: 'id,created_time,field_data,platform'
  };
  if (since) {
    params.filtering = JSON.stringify([{
      field: 'time_created',
      operator: 'GREATER_THAN',
      value: Math.floor(new Date(since).getTime() / 1000)
    }]);
  }

  while (url) {
    const resp = await axios.get(url, { params });
    if (resp.data.data) leads.push(...resp.data.data);
    url = resp.data.paging && resp.data.paging.next ? resp.data.paging.next : null;
    params = {};
  }
  return leads;
}

// ─── Resolve platform from lead metadata + form-level fallback ─────────────
function resolvePlatform(rawLeadPlatform, formPlatform, formName) {
  const lp = (rawLeadPlatform || '').toLowerCase();
  if (lp === 'fb' || lp === 'ig') return lp;
  const fp = (formPlatform || '').toLowerCase();
  if (fp === 'fb' || fp === 'ig') return fp;
  // keyword inference fallback
  const fn = (formName || '').toLowerCase();
  if (fn.includes('instagram')) return 'ig';
  if (fn.includes('website')) return 'website';
  if (fn.includes('facebook')) return 'fb';
  return 'unknown';
}

// ─── Upsert a single Meta lead into MongoDB ────────────────────────────────
async function upsertLead(rawLead, formId, formName, pageId, pageName, formPlatform = '') {
  const parsed = parseFieldData(rawLead.field_data || []);
  const platform = resolvePlatform(rawLead.platform, formPlatform, formName);
  const doc = {
    metaLeadId: rawLead.id,
    formId,
    formName,
    pageId,
    pageName,
    platform,
    createdTime: new Date(rawLead.created_time),
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone,
    city: parsed.city,
    businessCategory: parsed.businessCategory,
    websiteType: parsed.websiteType,
    fieldData: rawLead.field_data || [],
    syncedAt: new Date()
  };

  // upsert — don't overwrite CRM fields (status, assignedTo, notes) if lead exists
  // new: false returns the doc BEFORE the update; null means it was newly inserted
  const existing = await MetaLead.findOneAndUpdate(
    { metaLeadId: rawLead.id },
    { $set: doc, $setOnInsert: { status: 'New', assignedTo: null, notes: '' } },
    { upsert: true, new: false }
  );
  return existing === null; // true = newly inserted, false = already existed
}

// ─── Sync leads for ONE form ────────────────────────────────────────────────
async function syncForm(pageId, pageName, pageToken, formConfig, version) {
  const since = formConfig.lastLeadTime || null;
  const rawLeads = await getFormLeads(formConfig.formId, pageToken, version, since);

  let newCount = 0;
  let newestTime = formConfig.lastLeadTime ? new Date(formConfig.lastLeadTime) : null;

  for (const rawLead of rawLeads) {
    const isNew = await upsertLead(rawLead, formConfig.formId, formConfig.formName, pageId, pageName, formConfig.platform || '');
    if (isNew) newCount++;
    const lt = new Date(rawLead.created_time);
    if (!newestTime || lt > newestTime) newestTime = lt;
  }

  return { newCount, newestTime };
}

// ─── Full sync: all enabled pages → all enabled forms ──────────────────────
async function syncAllLeads() {
  const config = await MetaConfig.findOne();
  if (!config) throw new Error('Meta config not found. Please configure Meta API settings first.');

  const version = config.graphApiVersion || 'v25.0';
  const results = [];

  for (const page of config.pages) {
    if (!page.isEnabled) continue;

    for (let i = 0; i < page.forms.length; i++) {
      const form = page.forms[i];
      if (!form.isEnabled) continue;

      try {
        const { newCount, newestTime } = await syncForm(
          page.pageId, page.pageName, page.pageToken, form, version
        );

        // Update form sync metadata in config
        page.forms[i].lastSyncedAt = new Date();
        if (newestTime) page.forms[i].lastLeadTime = newestTime;

        results.push({ pageId: page.pageId, formId: form.formId, formName: form.formName, newCount, success: true });
      } catch (err) {
        results.push({ pageId: page.pageId, formId: form.formId, formName: form.formName, error: err.message, success: false });
      }
    }
  }

  config.lastFullSyncAt = new Date();
  config.markModified('pages');
  await config.save();

  return results;
}

// ─── Refresh pages & forms from Meta and update config ─────────────────────
async function refreshPagesAndForms(userAccessToken, version = 'v25.0') {
  const pages = await getPages(userAccessToken, version);
  const updatedPages = [];

  for (const page of pages) {
    // Fetch forms
    let forms = [];
    try {
      forms = await getLeadGenForms(page.id, page.access_token, version);
    } catch (_) {
      // some pages may lack permissions
    }

    updatedPages.push({
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
      isEnabled: true,
      forms: forms.map(f => ({
        formId: f.id,
        formName: f.name,
        platform: f.platform || '', // 'fb' | 'ig' | '' from Meta API
        status: f.status,
        isEnabled: f.status === 'ACTIVE',
        lastSyncedAt: null,
        lastLeadTime: null
      }))
    });
  }

  return updatedPages;
}

module.exports = {
  getPages,
  getLeadGenForms,
  getFormLeads,
  syncAllLeads,
  refreshPagesAndForms,
  parseFieldData
};
