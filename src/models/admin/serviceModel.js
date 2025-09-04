const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

function generateDbTableName(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")  // replace spaces & special chars with "_"
    .replace(/^_|_$/g, "");       // trim leading/trailing "_"
}

const Service = {
  isServiceCodeUnique: async (service_code, callback) => {
    const serviceCodeCheckSql = `
        SELECT COUNT(*) as count
        FROM \`services\`
        WHERE \`service_code\` = ?
      `;
    const serviceCodeCheckResults = await sequelize.query(serviceCodeCheckSql, {
      replacements: [service_code], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const serviceCodeExists = serviceCodeCheckResults[0].count > 0;
    return callback(null, serviceCodeExists);
  },

  createReportForm: async (service_id, admin_id, serviceTitle, callback) => {
    try {
      console.log("▶️ createReportForm called with:", { service_id, admin_id, serviceTitle });

      // Step 1: Check if entry already exists for this service_id
      console.log("🔍 Step 1: Checking if report form exists for service_id:", service_id);
      const checkSql = `
      SELECT * FROM \`report_forms\` WHERE \`service_id\` = ?
    `;
      const existing = await sequelize.query(checkSql, {
        replacements: [service_id],
        type: QueryTypes.SELECT,
      });
      console.log("✅ Step 1 Result:", existing);

      if (existing.length > 0) {
        console.log(`⚠️ Report form already exists for service_id: ${service_id}`);
        return callback(null, { message: "Report form already exists", service_id });
      }

      // Step 2: Generate a unique dbTable name
      console.log("⚙️ Step 2: Generating dbTable name from serviceTitle:", serviceTitle);
      const generateDbTableName = (title) => {
        return title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, "");
      };

      let baseName = generateDbTableName(serviceTitle);
      let dbTable = baseName;
      let counter = 1;

      console.log("👉 Generated base dbTable name:", baseName);

      // Ensure uniqueness in report_forms table
      while (true) {
        console.log(`🔎 Checking uniqueness for dbTable: ${dbTable}`);
        const checkTableSql = `
        SELECT COUNT(*) as count FROM \`report_forms\`
        WHERE JSON_EXTRACT(\`json\`, '$.db_table') = ?
      `;
        const [{ count }] = await sequelize.query(checkTableSql, {
          replacements: [dbTable],
          type: QueryTypes.SELECT,
        });
        console.log("🔢 Found count:", count);

        if (count === 0) {
          console.log("✅ Unique dbTable found:", dbTable);
          break;
        }
        dbTable = `${baseName}_${counter++}`;
        console.log("⚠️ dbTable exists, trying next:", dbTable);
      }

      // Step 3: JSON template
      console.log("📝 Step 3: Preparing JSON template for dbTable:", dbTable);
      const json = `{
      "heading": "{{serviceTitle}}",
      "db_table": "{{dbTable}}",
      "headers": [
        "PARTICULARS",
        "APPLICANT DETAILS",
        "VERIFIED DETAILS"
      ],
      "rows": [
        {
          "label": "Name Of The Applicant:",
          "inputs": [
            { "name": "name_of_the_applicant{{dbTable}}", "type": "text" },
            { "name": "verified_name_of_the_applicant{{dbTable}}", "type": "text" }
          ]
        },
        {
          "label": "Information Source:",
          "inputs": [
            { "name": "information_source{{dbTable}}", "type": "text" }
          ]
        },
        {
          "label": "Date Of Verification:",
          "inputs": [
            { "name": "date_of_verification{{dbTable}}", "type": "datepicker" }
          ]
        },
        {
          "label": "Additional Fee:",
          "inputs": [
            { "name": "additional_fee{{dbTable}}", "type": "text" }
          ]
        },
        {
          "label": "Remarks:",
          "inputs": [
            { "name": "remarks{{dbTable}}", "type": "text" }
          ]
        },
        {
          "label": "Annexure:",
          "inputs": [
            { "name": "annexure{{dbTable}}", "type": "file", "multiple": true, "required": true }
          ]
        },
        {
          "label": "Colour Code:",
          "inputs": [
            {
              "name": "colour_code{{dbTable}}",
              "type": "dropdown",
              "options": [
                { "value": "", "showText": "Select Colour" },
                { "value": "green", "showText": "GREEN" },
                { "value": "red", "showText": "RED" },
                { "value": "yellow", "showText": "YELLOW" },
                { "value": "orange", "showText": "ORANGE" },
                { "value": "pink", "showText": "PINK" }
              ]
            }
          ]
        }
      ]
    }`;

      // Step 4: Replace placeholders
      console.log("🛠 Step 4: Replacing placeholders in JSON template...");
      const updatedJson = json
        .replaceAll("{{serviceTitle}}", serviceTitle)
        .replaceAll("{{dbTable}}", dbTable);
      console.log("✅ Final JSON:", updatedJson);

      // Step 5: Insert new entry
      console.log("📥 Step 5: Inserting new report form into DB...");
      const insertSql = `
      INSERT INTO \`report_forms\` (\`service_id\`, \`admin_id\`, \`json\`)
      VALUES (?, ?, ?)
    `;
      const results = await sequelize.query(insertSql, {
        replacements: [service_id, admin_id, updatedJson],
        type: QueryTypes.INSERT,
      });
      console.log("✅ Insert successful. Results:", results);

      console.log(`🎉 New report form created for service_id: ${service_id}, db_table: ${dbTable}`);
      return callback(null, { message: "Report form created successfully", dbTable, results });

    } catch (err) {
      console.error("❌ Error creating report form:", err);
      return callback(err, null);
    }
  },


  create: async (
    title,
    description,
    group_id,
    service_code,
    hsn_code,
    admin_id,
    callback
  ) => {
    // Step 1: Check if a service with the same title already exists
    const checkServiceSql = `
      SELECT * FROM \`services\` WHERE \`title\` = ? OR \`service_code\` = ?
    `;
    const serviceResults = await sequelize.query(checkServiceSql, {
      replacements: [title, service_code], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    // Step 2: If a service with the same title exists, return an error
    if (serviceResults.length > 0) {
      const error = new Error(
        "Service with the same name or service code already exists"
      );
      console.error(error.message);
      return callback(error, null);
    }

    const insertServiceSql = `
          INSERT INTO \`services\` (\`title\`, \`description\`, \`group_id\`, \`service_code\`,  \`hsn_code\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
    const results = await sequelize.query(insertServiceSql, {
      replacements: [title, description, group_id, service_code, hsn_code, admin_id], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);

  },

  list: async (callback) => {
    const sql = `
      SELECT 
        s.*, 
        sg.title AS group_name 
      FROM \`services\` s
      JOIN \`service_groups\` sg ON s.group_id = sg.id
    `;


    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    callback(null, results);

  },

  digitlAddressService: async (callback) => {
    const sql = `
      SELECT * FROM \`services\`
      WHERE LOWER(\`title\`) LIKE '%digital%'
      AND (LOWER(\`title\`) LIKE '%verification%' OR LOWER(\`title\`) LIKE '%address%')
      LIMIT 1
    `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const singleEntry = results.length > 0 ? results[0] : null;
    callback(null, singleEntry); // Return single entry or null if not found


  },

  getServiceById: async (id, callback) => {
    const sql = `SELECT * FROM \`services\` WHERE \`id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  getServiceRequiredDocumentsByServiceId: async (service_id, callback) => {
    const sql = `SELECT * FROM \`service_required_documents\` WHERE \`service_id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [service_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);

  },

  update: async (
    id,
    title,
    description,
    group_id,
    service_code,
    hsn_code,
    callback
  ) => {
    const sql = `
      UPDATE \`services\`
      SET \`title\` = ?, \`description\` = ?, \`group_id\` = ?, \`service_code\` = ?, \`hsn_code\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [title, description, group_id, service_code, hsn_code, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`services\`
      WHERE \`id\` = ?
    `;


    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, results);

  },

  servicesWithGroup: async (callback) => {
    const sql = `
      SELECT 
        sg.id AS group_id, 
        sg.symbol, 
        sg.title AS group_title, 
        s.id AS service_id, 
        s.title AS service_title,
        s.service_code AS service_code
      FROM 
        service_groups sg
      LEFT JOIN 
        services s ON s.group_id = sg.id
      ORDER BY 
        sg.id, s.id
    `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const groupedData = [];
    const groupMap = new Map();

    results.forEach((row) => {
      const {
        group_id,
        symbol,
        group_title,
        service_id,
        service_title,
        service_code,
      } = row;

      // Retrieve the group from the map, or initialize a new entry
      let group = groupMap.get(group_id);
      if (!group) {
        group = {
          group_id,
          symbol,
          group_title,
          services: [],
        };
        groupMap.set(group_id, group);
        groupedData.push(group);
      }

      // Add service details if the service exists
      if (service_id) {
        group.services.push({
          service_id,
          service_title,
          service_code,
        });
      }
    });

    callback(null, groupedData);


  },
};

module.exports = Service;
