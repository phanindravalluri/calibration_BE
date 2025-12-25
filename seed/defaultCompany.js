// seed/defaultCompany.js
const Company = require("../models/Company");

const DEFAULT_COMPANY_NAME =
  process.env.DEFAULT_COMPANY_NAME || "Bhanu Company";

async function ensureDefaultCompany() {
  let company = await Company.findOne({ name: DEFAULT_COMPANY_NAME });

  if (!company) {
    company = await Company.create({
      name: DEFAULT_COMPANY_NAME,
      code: DEFAULT_COMPANY_NAME.toUpperCase().replace(/\s+/g, "_"),
    });
  } else {
    console.log("ℹ️ Default company exists:", company.name);
  }

  return company;
}

module.exports = ensureDefaultCompany;
