const crypto = require("crypto");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

const moment = require("moment");
// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

function calculateDueDate(startDate, tatDays = 0, holidayDates, weekendsSet) {
  // console.log("Starting calculation...");
  // console.log("Start Date:", startDate.format("YYYY-MM-DD"));
  // console.log("TAT Days:", tatDays);
  // console.log("Holiday Dates:", holidayDates.map(date => date.format("YYYY-MM-DD")));
  // console.log("Weekends Set:", weekendsSet);

  // Track remaining TAT days to process
  let remainingDays = tatDays;

  // Generate potential dates to check
  const potentialDates = Array.from({ length: tatDays * 2 }, (_, i) =>
    startDate.clone().add(i + 1, "days")
  );

  // console.log("Generated Potential Dates:", potentialDates.map(date => date.format("YYYY-MM-DD")));

  // Calculate the final due date
  let finalDueDate = potentialDates.find((date) => {
    const dayName = date.format("dddd").toLowerCase();
    // console.log(`Checking date: ${date.format("YYYY-MM-DD")} (Day: ${dayName})`);

    // Skip weekends
    if (weekendsSet.has(dayName)) {
      // console.log(`Skipping ${date.format("YYYY-MM-DD")} - It's a weekend.`);
      return false;
    }

    // Skip holidays
    if (holidayDates.some((holiday) => holiday.isSame(date, "day"))) {
      // console.log(`Skipping ${date.format("YYYY-MM-DD")} - It's a holiday.`);
      return false;
    }

    remainingDays--;
    // console.log(`Remaining Days: ${remainingDays}`);

    return remainingDays <= 0;
  });

  // console.log("Final Due Date:", finalDueDate ? finalDueDate.format("YYYY-MM-DD") : "Not Found");
  return finalDueDate;
}

const Customer = {
  list: async (filter_status, callback) => {
    let client_application_ids = [];



    if (filter_status && filter_status !== null && filter_status !== "") {

      // Get the current date
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let sql = `SELECT customer_id FROM customers WHERE status = 1`;
      switch (filter_status) {
        case 'overallCount':
          sql = `
          SELECT DISTINCT
            a.id,
            a.customer_id
          FROM 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          WHERE
            (
              b.overall_status = 'wip'
              OR b.overall_status = 'insuff'
              OR (b.overall_status = 'completed' 
                AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
              )
            )
            AND c.is_deleted != 1
            AND (c.status = 1)
            AND a.is_deleted != 1
    `;
          break;
        case 'qcStatusPendingCount':
          sql = `
          SELECT DISTINCT
            a.id,
            a.customer_id
          FROM 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id
          WHERE
            a.is_report_downloaded = '1'
            AND LOWER(b.is_verify) = 'no'
            AND a.status = 'completed'
            AND c.is_deleted != 1
            AND a.is_deleted != 1
          ORDER BY 
            b.id DESC;
      `;
          break;
        case 'wipCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE 
                      c.status = 1
                      AND b.overall_status = 'wip'
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'insuffCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE 
                      c.status = 1
                      AND b.overall_status = 'insuff'
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'previousCompletedCount':
          sql = `
          SELECT DISTINCT
            a.id,
            a.customer_id
            FROM 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            WHERE
              b.overall_status = 'completed'
              AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
              AND c.status = 1
              AND c.is_deleted != 1
              AND a.is_deleted != 1;
      `;
          break;
        case 'stopcheckCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'stopcheck'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'activeEmploymentCount':
          sql = `
          SELECT DISTINCT
            a.id,
            a.customer_id
            FROM 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            WHERE
              b.overall_status = 'active employment'
              AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
              AND c.status = 1
              AND c.is_deleted != 1
              AND a.is_deleted != 1;
      `;
          break;
        case 'nilCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'nil'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'notDoableCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'not doable'
                      AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
                      AND c.status = 1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'candidateDeniedCount':
          sql = `
          SELECT DISTINCT
            a.id,
            a.customer_id
            FROM 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            WHERE
              b.overall_status = 'candidate denied'
              AND (b.report_date LIKE CONCAT('${yearMonth}', '%') OR b.report_date LIKE CONCAT('%', '${monthYear}'))
              AND c.status = 1
              AND c.is_deleted != 1
              AND a.is_deleted != 1;
      `;
          break;
        case 'completedGreenCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'GREEN'
                      AND c.is_deleted != 1
                      AND c.status=1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'completedRedCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'RED'
                      AND c.status=1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'completedYellowCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status  = 'YELLOW'
                      AND c.status=1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'completedPinkCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'PINK'
                      AND c.status=1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
        case 'completedOrangeCount':
          sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND b.final_verification_status = 'ORANGE'
                      AND c.status=1
                      AND c.is_deleted != 1
                      AND a.is_deleted != 1;
              `;
          break;
      }
      const results = await sequelize.query(sql, {
        type: QueryTypes.SELECT,
      });
      // Loop through results and push customer_id to the array
      results.forEach((row) => {
        client_application_ids.push(row.id);
      });

      let customersIDConditionString = "";
      if (client_application_ids.length > 0) {
        customersIDConditionString = ` AND customers.id IN (${customers_id.join(
          ","
        )})`;
      } else {
        return callback(null, []);
      }
      const finalSql = `
         WITH BranchesCTE AS (
                SELECT 
                    b.id AS branch_id,
                    b.customer_id
                FROM 
                    branches b
            )
            SELECT 
                customers.client_unique_id,
                customers.name,
                customer_metas.tat_days,
                customer_metas.single_point_of_contact,
                customer_metas.client_spoc_name,
                customers.id AS main_id,
                COALESCE(branch_counts.branch_count, 0) AS branch_count,
                COALESCE(application_counts.application_count, 0) AS application_count
            FROM 
                customers
            LEFT JOIN 
                customer_metas ON customers.id = customer_metas.customer_id
            LEFT JOIN (
                SELECT 
                    customer_id, 
                    COUNT(*) AS branch_count
                FROM 
                    branches
                GROUP BY 
                    customer_id
            ) AS branch_counts ON customers.id = branch_counts.customer_id
            LEFT JOIN (
                SELECT 
                    b.customer_id, 
                    COUNT(ca.id) AS application_count,
                    MAX(ca.created_at) AS latest_application_date
                FROM 
                    BranchesCTE b
                INNER JOIN 
                    client_applications ca ON b.branch_id = ca.branch_id
                WHERE
                  ca.is_data_qc = 1
                  AND ca.id IN (${client_application_ids.join(",")})
                  AND ca.is_deleted != 1
                GROUP BY 
                    b.customer_id
            ) AS application_counts ON customers.id = application_counts.customer_id
            WHERE 
                customers.status = 1
                AND customers.is_deleted != 1
                AND COALESCE(application_counts.application_count, 0) > 0
            ORDER BY 
                application_counts.latest_application_date DESC;
          `;

      connection.query(finalSql, async (err, results) => {

        // Always release the connection
        if (err) {
          console.error("Database query error: 38", err);
          return callback(err, null);
        }

        for (const result of results) {

          const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ? AND ca.is_deleted != 1`;
          const headBranchApplicationsCount = await new Promise(
            (resolve, reject) => {
              connection.query(
                headBranchApplicationsCountQuery,
                [result.main_id, result.main_id, 1], // Parameters passed correctly
                (headBranchErr, headBranchResults) => {
                  if (headBranchErr) {
                    return reject(headBranchErr);
                  }
                  resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result
                }
              );
            }
          );
          console.log(`rawResult - `, result);
          result.head_branch_applications_count =
            headBranchApplicationsCount;
          // if (result.branch_count === 1) {
          // Query client_spoc table to fetch names for these IDs
          const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

          try {
            const headBranchID = await new Promise((resolve, reject) => {
              connection.query(
                headBranchQuery,
                [result.main_id, 1], // Properly pass query parameters as an array
                (headBranchErr, headBranchResults) => {
                  if (headBranchErr) {
                    return reject(headBranchErr);
                  }
                  resolve(
                    headBranchResults.length > 0
                      ? headBranchResults[0].id
                      : null
                  );
                }
              );
            });

            // Attach head branch id and application count to the current result
            result.head_branch_id = headBranchID;
          } catch (headBranchErr) {
            console.error(
              "Error fetching head branch id or applications count:",
              headBranchErr
            );
            result.head_branch_id = null;
            result.head_branch_applications_count = 0;
          }
          // }
        }
        console.log(`results - `, results);
        callback(null, results);
      });

    } else {
      // If no filter_status is provided, proceed with the final SQL query without filters
      const finalSql = `
         WITH BranchesCTE AS (
              SELECT 
                  b.id AS branch_id,
                  b.customer_id
              FROM 
                  branches b
          )
          SELECT 
              customers.client_unique_id,
              customers.name,
              customer_metas.tat_days,
              customer_metas.single_point_of_contact,
              customer_metas.client_spoc_name,
              customers.id AS main_id,
              COALESCE(branch_counts.branch_count, 0) AS branch_count,
              COALESCE(application_counts.application_count, 0) AS application_count
          FROM 
              customers
          LEFT JOIN 
              customer_metas ON customers.id = customer_metas.customer_id
          LEFT JOIN (
              SELECT 
                  customer_id, 
                  COUNT(*) AS branch_count
              FROM 
                  branches
              GROUP BY 
                  customer_id
          ) AS branch_counts ON customers.id = branch_counts.customer_id
          LEFT JOIN (
              SELECT 
                  b.customer_id, 
                  COUNT(ca.id) AS application_count,
                  MAX(ca.created_at) AS latest_application_date
              FROM 
                  BranchesCTE b
              INNER JOIN 
                  client_applications ca ON b.branch_id = ca.branch_id
              WHERE ca.is_data_qc = 1 AND ca.is_deleted != 1
              GROUP BY 
                  b.customer_id
          ) AS application_counts ON customers.id = application_counts.customer_id
          WHERE 
              customers.status = 1
              AND customers.is_deleted != 1
              AND COALESCE(application_counts.application_count, 0) > 0
          ORDER BY 
              application_counts.latest_application_date DESC;
        `;

      const results = await sequelize.query(finalSql, {
        type: QueryTypes.SELECT,
      });
      for (const result of results) {
        const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ? AND ca.is_data_qc = ? AND ca.is_deleted != 1`;

        const headBranchResults = await sequelize.query(headBranchApplicationsCountQuery, {
          replacements: [result.main_id, result.main_id, 1, 1], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });
        const headBranchApplicationsCount = await new Promise((resolve) =>
          resolve(headBranchResults[0]["COUNT(*)"])
        );
        result.head_branch_applications_count = headBranchApplicationsCount;
        // if (result.branch_count === 1) {
        // Query client_spoc table to fetch names for these IDs
        const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;


        const headBranchID = await new Promise(async (resolve, reject) => {
          const headBranchResults = await sequelize.query(headBranchQuery, {
            replacements: [result.main_id, 1], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
          resolve(
            headBranchResults.length > 0
              ? headBranchResults[0].id
              : null
          );
        });
        result.head_branch_id = headBranchID;
      }
      callback(null, results);

    }

  },

  listByCustomerID: async (customer_id, filter_status, callback) => {

    // Base SQL query with mandatory condition for status
    let sql = `
        SELECT b.id AS branch_id, 
               b.name AS branch_name, 
               COUNT(ca.id) AS application_count,
               MAX(ca.created_at) AS latest_application_date
        FROM client_applications ca
        INNER JOIN branches b ON ca.branch_id = b.id
        WHERE b.is_head != 1 AND b.customer_id = ? AND ca.is_data_qc = 1 AND ca.is_deleted != 1`;

    const queryParams = [customer_id];

    // Check if filter_status is provided
    if (filter_status && filter_status !== null && filter_status !== "") {
      sql += ` AND ca.status = ?`;
      queryParams.push(filter_status);
    }

    sql += ` GROUP BY b.id, b.name 
                ORDER BY latest_application_date DESC;`;

    const results = await sequelize.query(sql, {
      replacements: queryParams, // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results);


  },

  applicationListByBranch: async (
    filter_status,
    branch_id,
    filter_month,
    callback
  ) => {
    try {
      // Fetch holidays
      const holidaysQuery = `SELECT id AS holiday_id, title AS holiday_title, date AS holiday_date FROM holidays;`;
      const holidayResults = await sequelize.query(holidaysQuery, { type: QueryTypes.SELECT });

      // Prepare holiday dates for calculations
      const holidayDates = holidayResults.map(holiday => moment(holiday.holiday_date).startOf("day"));

      // Fetch weekends
      const weekendsQuery = `SELECT weekends FROM company_info WHERE status = 1;`;
      const weekendResults = await sequelize.query(weekendsQuery, { type: QueryTypes.SELECT });

      const weekends = weekendResults[0]?.weekends ? JSON.parse(weekendResults[0].weekends) : [];
      const weekendsSet = new Set(weekends.map(day => day.toLowerCase()));

      const now = new Date();
      const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      // Define SQL conditions for each filter status
      const conditions = {
        overallCount: `AND (cmt.overall_status='wip' OR cmt.overall_status='insuff' OR cmt.overall_status='initiated' OR cmt.overall_status='hold' OR cmt.overall_status='closure advice' OR cmt.overall_status='stopcheck' OR cmt.overall_status='active employment' OR cmt.overall_status='nil' OR cmt.overall_status='' OR cmt.overall_status='not doable' OR cmt.overall_status='candidate denied' OR (cmt.overall_status='completed' AND cmt.report_date LIKE '%-${month}-%') OR (cmt.overall_status='completed' AND cmt.report_date NOT LIKE '%-${month}-%')) AND c.status = 1`,
        qcStatusPendingCount: `AND ca.is_report_downloaded = '1' AND LOWER(cmt.is_verify) = 'no' AND ca.status = 'completed'`,
        wipCount: `AND cmt.overall_status = 'wip'`,
        insuffCount: `AND cmt.overall_status = 'insuff'`,
        completedGreenCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'GREEN'`,
        completedRedCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'RED'`,
        completedYellowCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'YELLOW'`,
        completedPinkCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'PINK'`,
        completedOrangeCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '%-${month}-%' AND cmt.final_verification_status = 'ORANGE'`,
        previousCompletedCount: `AND (cmt.overall_status = 'completed' AND cmt.report_date NOT LIKE '%-${month}-%') AND c.status=1`,
        stopcheckCount: `AND cmt.overall_status = 'stopcheck'`,
        activeEmploymentCount: `AND cmt.overall_status = 'active employment'`,
        nilCount: `AND cmt.overall_status IN ('nil', '')`,
        candidateDeniedCount: `AND cmt.overall_status = 'candidate denied'`,
        notDoableCount: `AND cmt.overall_status = 'not doable'`,
        initiatedCount: `AND cmt.overall_status = 'initiated'`,
        holdCount: `AND cmt.overall_status = 'hold'`,
        closureAdviceCount: `AND cmt.overall_status = 'closure advice'`
      };

      // Construct SQL condition based on filter_status
      let sqlCondition = '';
      if (filter_status && filter_status.trim() !== "") {
        sqlCondition = conditions[filter_status] || '';
      }

      // Base SQL query with JOINs to fetch data
      let sql = `
          SELECT 
          ca.*, 
          c.name AS customer_name,
          b.name AS branch_name, 
          ca.id AS main_id,
          ca.is_highlight, 
          cmt.first_insufficiency_marks,
          cmt.first_insuff_date,
          cm.custom_logo,
          cm.custom_template,
          cm.custom_address,
          cm.client_spoc_name,
          cm.tat_days,
          cm.deadline_date,
          cmt.first_insuff_reopened_date,
          cmt.second_insufficiency_marks,
          cmt.second_insuff_date,
          cmt.second_insuff_reopened_date,
          cmt.third_insufficiency_marks,
          cmt.third_insuff_date,
          cmt.third_insuff_reopened_date,
          cmt.final_verification_status,
          cmt.dob,
          cmt.is_verify,
          cmt.qc_done_by,
          cmt.report_date,
          cmt.case_upload,
          cmt.report_type,
          cmt.delay_reason,
          cmt.report_status,
          cmt.overall_status,
          cmt.initiation_date,
          cmt.report_generate_by,
          qc_admin.name AS qc_done_by_name,
          report_admin.name AS report_generated_by_name
        FROM 
          \`client_applications\` ca
        LEFT JOIN 
          \`customers\` c ON c.id = ca.customer_id
        LEFT JOIN 
          \`customer_metas\` cm ON cm.customer_id = ca.customer_id
        LEFT JOIN 
          \`branches\` b ON b.id = ca.branch_id
        LEFT JOIN 
          \`cmt_applications\` cmt ON ca.id = cmt.client_application_id
        LEFT JOIN 
          \`admins\` AS qc_admin ON qc_admin.id = cmt.qc_done_by
        LEFT JOIN 
          \`admins\` AS report_admin ON report_admin.id = cmt.report_generate_by
        WHERE 
          ca.\`branch_id\` = ?
          AND ca.\`is_data_qc\` = 1
          AND ca.is_deleted != 1
          AND c.is_deleted != 1
          ${sqlCondition}
      `;

      // Parameters for SQL query
      const params = [branch_id];

      // Apply filter_month condition if provided
      if (filter_month && filter_month.trim() !== "") {
        sql += ` AND ca.\`created_at\` LIKE ?`; // Use LIKE for partial match
        params.push(`${filter_month}%`); // Append "%" to filter by year-month
      }

      // Final ordering of results
      sql += ` ORDER BY ca.\`created_at\` DESC, ca.\`is_highlight\` DESC`;
      // Execute query
      const results = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

      // Format results
      const formattedResults = results.map((result, index) => {
        return {
          ...result,
          created_at: new Date(result.created_at).toISOString(), // Format created_at
        };
      });
      callback(null, formattedResults);
    } catch (err) {
      console.error("Error fetching applications:", err);
      callback(err, null);
    }
  },


  applicationByID: async (application_id, branch_id, callback) => {

    const sql =
      "SELECT * FROM `client_applications` WHERE `id` = ? AND `branch_id` = ? AND `is_deleted` != 1 ORDER BY `created_at` DESC";
    const results = await sequelize.query(sql, {
      replacements: [application_id, branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results[0] || null); // Return single application or null if not found
  },

  annexureData: async (client_application_id, db_table, callback) => {

    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;
    const results = await sequelize.query(checkTableSql, {
      replacements: [db_table],
      type: QueryTypes.SELECT,
    });


    if (results[0].count === 0) {
      const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
              \`cmt_id\` bigint(20) DEFAULT NULL,
              \`client_application_id\` bigint(20) NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` VARCHAR(100) DEFAULT NULL,
              \`team_management_docs\` LONGTEXT DEFAULT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`client_application_id\` (\`client_application_id\`),
              KEY \`cmt_application_customer_id\` (\`customer_id\`),
              KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
              CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
    } else {
      fetchData();
    }

    async function fetchData() {
      // Now that we know the table exists, run the original query
      const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;

      const results = await sequelize.query(sql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      callback(null, results[0] || null);
    }


  },

  filterOptions: async (callback) => {

    const sql = `
        SELECT \`status\`, COUNT(*) AS \`count\` 
        FROM \`client_applications\` 
        WHERE \`is_deleted\` != 1
        GROUP BY \`status\`
      `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);


  },

  filterOptionsForCustomers: async (callback) => {

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

    let filterOptions = {
      overallCount: 0,
      qcStatusPendingCount: 0,
      wipCount: 0,
      insuffCount: 0,
      previousCompletedCount: 0,
      stopcheckCount: 0,
      activeEmploymentCount: 0,
      nilCount: 0,
      notDoableCount: 0,
      candidateDeniedCount: 0,
      completedGreenCount: 0,
      completedRedCount: 0,
      completedYellowCount: 0,
      completedPinkCount: 0,
      completedOrangeCount: 0,
    };

    const overallCountSQL = `
        SELECT
          COUNT(*) as overall_count
        FROM 
          client_applications a 
          JOIN customers c ON a.customer_id = c.id
          JOIN cmt_applications b ON a.id = b.client_application_id 
        WHERE
          (
            b.overall_status = 'wip'
            OR b.overall_status = 'insuff'
            OR (b.overall_status = 'completed' 
              AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
            )
          )
          AND c.is_deleted != 1
          AND a.is_deleted != 1
          AND (c.status = 1)
      `;
    const overallCountResult = await sequelize.query(overallCountSQL, {
      type: QueryTypes.SELECT,
    });
    if (overallCountResult.length > 0) {
      filterOptions.overallCount = overallCountResult[0].overall_count || 0;
    }

    const qcStatusPendingSQL = `
          select
            count(*) as overall_count
          from 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          where
            a.is_report_downloaded='1'
            AND LOWER(b.is_verify)='no'
            AND a.status='completed'
            AND c.is_deleted != 1
            AND a.is_deleted != 1
          order by 
            b.id DESC
        `;


    const qcStatusPendingResult = await sequelize.query(qcStatusPendingSQL, {
      type: QueryTypes.SELECT,
    });

    if (qcStatusPendingResult.length > 0) {
      filterOptions.qcStatusPendingCount = qcStatusPendingResult[0].overall_count || 0;
    }

    const wipInsuffSQL = `
          SELECT 
            b.overall_status, 
            COUNT(*) AS overall_count
          FROM 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          WHERE 
            c.status = 1
            AND b.overall_status IN ('wip', 'insuff')
            AND a.is_deleted != 1
            AND c.is_deleted != 1
          GROUP BY 
            b.overall_status
        `;
    const wipInsuffResult = await sequelize.query(wipInsuffSQL, {
      type: QueryTypes.SELECT,
    });
    wipInsuffResult.forEach(row => {
      if (row.overall_status === 'wip') {
        filterOptions.wipCount = row.overall_count;
      } else if (row.overall_status === 'insuff') {
        filterOptions.insuffCount = row.overall_count;
      }
    });

    const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL = `
            SELECT
              COUNT(*) as overall_count,
              b.overall_status
            from 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            where
              b.overall_status IN ('completed','stopcheck','active employment','nil','not doable','candidate denied')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
              AND c.status=1
              AND a.is_deleted != 1
              AND c.is_deleted != 1
            GROUP BY
              b.overall_status
          `;
    const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult = await sequelize.query(completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL, {
      type: QueryTypes.SELECT,
    });

    completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult.forEach(row => {
      if (row.overall_status === 'completed') {
        filterOptions.previousCompletedCount = row.overall_count;
      } else if (row.overall_status === 'stopcheck') {
        filterOptions.stopcheckCount = row.overall_count;
      } else if (row.overall_status === 'active employment') {
        filterOptions.activeEmploymentCount = row.overall_count;
      } else if (row.overall_status === 'nil' || row.overall_status === '' || row.overall_status === null) {
        filterOptions.nilCount = row.overall_count;
      } else if (row.overall_status === 'not doable') {
        filterOptions.notDoableCount = row.overall_count;
      } else if (row.overall_status === 'candidate denied') {
        filterOptions.candidateDeniedCount = row.overall_count;
      }
    });

    const completedGreenRedYellowPinkOrangeSQL = `
              SELECT
                COUNT(*) as overall_count,
                b.final_verification_status
              from
                client_applications a 
                JOIN customers c ON a.customer_id = c.id
                JOIN cmt_applications b ON a.id = b.client_application_id 
              where
                b.overall_status ='completed'
                AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
                AND c.status=1
                AND a.is_deleted != 1
                AND c.is_deleted != 1
              GROUP BY
                b.final_verification_status
            `;
    const completedGreenRedYellowPinkOrangeResult = await sequelize.query(completedGreenRedYellowPinkOrangeSQL, {
      type: QueryTypes.SELECT,
    });

    completedGreenRedYellowPinkOrangeResult.forEach(row => {
      if (row.final_verification_status === 'GREEN') {
        filterOptions.completedGreenCount = row.overall_count;
      } else if (row.final_verification_status === 'RED') {
        filterOptions.completedRedCount = row.overall_count;
      } else if (row.final_verification_status === 'YELLOW') {
        filterOptions.completedYellowCount = row.overall_count;
      } else if (row.final_verification_status === 'PINK') {
        filterOptions.completedPinkCount = row.overall_count;
      } else if (row.final_verification_status === 'ORANGE') {
        filterOptions.completedOrangeCount = row.overall_count;
      }
    });

    return callback(null, filterOptions);

    ;


  },


  filterOptionsForApplicationListing: (customer_id, branch_id, callback) => {


    const now = new Date();
    const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
    const year = `${now.getFullYear()}`;
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

    let filterOptions = {
      overallCount: 0,
      wipCount: 0,
      insuffCount: 0,
      completedGreenCount: 0,
      completedRedCount: 0,
      completedYellowCount: 0,
      completedPinkCount: 0,
      completedOrangeCount: 0,
      previousCompletedCount: 0,
      stopcheckCount: 0,
      activeEmploymentCount: 0,
      nilCount: 0,
      candidateDeniedCount: 0,
      notDoableCount: 0,
      initiatedCount: 0,
      holdCount: 0,
      closureAdviceCount: 0,
    };

    let conditions = {
      overallCount: `AND (b.overall_status='wip' OR b.overall_status='insuff' OR b.overall_status='initiated' OR b.overall_status='hold' OR b.overall_status='closure advice' OR b.overall_status='stopcheck' OR b.overall_status='active employment' OR b.overall_status='nil' OR b.overall_status='' OR b.overall_status='not doable' OR b.overall_status='candidate denied' OR (b.overall_status='completed' AND b.report_date LIKE '%-${month}-%') OR (b.overall_status='completed' AND b.report_date NOT LIKE '%-${month}-%'))`,
      wipCount: `AND (b.overall_status = 'wip')`,
      insuffCount: `AND (b.overall_status = 'insuff')`,
      completedGreenCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='GREEN'`,
      completedRedCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='RED'`,
      completedYellowCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='YELLOW'`,
      completedPinkCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='PINK'`,
      completedOrangeCount: `AND (b.overall_status = 'completed' AND b.report_date LIKE '%-${month}-%') AND b.final_verification_status='ORANGE'`,
      previousCompletedCount: `AND (b.overall_status = 'completed' AND b.report_date NOT LIKE '%-${month}-%')`,
      stopcheckCount: `AND (b.overall_status = 'stopcheck')`,
      activeEmploymentCount: `AND (b.overall_status = 'active employment')`,
      nilCount: `AND (b.overall_status = 'nil' OR b.overall_status = '')`,
      candidateDeniedCount: `AND (b.overall_status = 'candidate denied')`,
      notDoableCount: `AND (b.overall_status = 'not doable')`,
      initiatedCount: `AND (b.overall_status = 'initiated')`,
      holdCount: `AND (b.overall_status = 'hold')`,
      closureAdviceCount: `AND (b.overall_status = 'closure advice')`
    };

    let sqlQueries = [];

    // Build SQL queries for each filter option
    for (let key in filterOptions) {
      if (filterOptions.hasOwnProperty(key)) {
        let condition = conditions[key];
        if (condition) {
          const SQL = `
              SELECT count(*) AS ${key}
              FROM client_applications a
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id
              WHERE a.customer_id = ? 
              AND CAST(a.branch_id AS CHAR) = ? 
              ${condition}
              AND c.status = 1
              AND a.is_deleted != 1
              AND c.is_deleted != 1
            `;

          sqlQueries.push(new Promise(async (resolve, reject) => {
            const result = await sequelize.query(SQL, {
              replacements: [customer_id, branch_id], // Positional replacements using ?
              type: QueryTypes.SELECT,
            });
            filterOptions[key] = result[0] ? result[0][key] : 0;
            resolve();
          }));
        }
      }
    }

    // After all queries finish, execute the callback
    Promise.all(sqlQueries)
      .then(() => {
        callback(null, filterOptions);
      })
      .catch((err) => {
        callback(err, null);
      });

  },

  filterOptionsForBranch: async (branch_id, callback) => {

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

    let filterOptions = {
      overallCount: 0,
      qcStatusPendingCount: 0,
      wipCount: 0,
      insuffCount: 0,
      previousCompletedCount: 0,
      stopcheckCount: 0,
      activeEmploymentCount: 0,
      nilCount: 0,
      notDoableCount: 0,
      candidateDeniedCount: 0,
      completedGreenCount: 0,
      completedRedCount: 0,
      completedYellowCount: 0,
      completedPinkCount: 0,
      completedOrangeCount: 0,
    };

    const overallCountSQL = `
         SELECT
          COUNT(*) as overall_count
        FROM 
          client_applications a 
          JOIN customers c ON a.customer_id = c.id
          JOIN cmt_applications b ON a.id = b.client_application_id 
        WHERE
          (
            b.overall_status = 'wip'
            OR b.overall_status = 'insuff'
            OR (b.overall_status = 'completed' 
              AND b.final_verification_status IN ('GREEN', 'RED', 'YELLOW', 'PINK', 'ORANGE')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
            )
          )
          AND a.is_deleted != 1
          AND c.is_deleted != 1
          AND (c.status = 1)
          AND CAST(a.branch_id AS CHAR) = ?
      `;
    console.log(`overallCountSQL - `, overallCountSQL);
    const overallCountResult = await sequelize.query(overallCountSQL, {
      replacements: [String(branch_id)], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    if (overallCountResult.length > 0) {
      filterOptions.overallCount = overallCountResult[0].overall_count || 0;
    }

    const qcStatusPendingSQL = `
             select
            count(*) as overall_count
          from 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          where
            a.is_report_downloaded='1'
            AND LOWER(b.is_verify)='no'
            AND a.status='completed'
            AND a.is_deleted != 1
            AND c.is_deleted != 1
            AND CAST(a.branch_id AS CHAR) = ?
          order by 
            b.id DESC
        `;
    console.log(`qcStatusPendingSQL - `, qcStatusPendingSQL);
    const qcStatusPendingResult = await sequelize.query(qcStatusPendingSQL, {
      replacements: [String(branch_id)], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (qcStatusPendingResult.length > 0) {
      filterOptions.qcStatusPendingCount = qcStatusPendingResult[0].overall_count || 0;
    }

    const wipInsuffSQL = `
           SELECT 
            b.overall_status, 
            COUNT(*) AS overall_count
          FROM 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          WHERE 
            c.status = 1
            AND b.overall_status IN ('wip', 'insuff')
            AND CAST(a.branch_id AS CHAR) = ?
            AND a.is_deleted != 1
            AND c.is_deleted != 1
          GROUP BY 
            b.overall_status
        `;
    console.log(`wipInsuffSQL - `, wipInsuffSQL);

    const wipInsuffResult = await sequelize.query(wipInsuffSQL, {
      replacements: [String(branch_id)], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    wipInsuffResult.forEach(row => {
      if (row.overall_status === 'wip') {
        filterOptions.wipCount = row.overall_count;
      } else if (row.overall_status === 'insuff') {
        filterOptions.insuffCount = row.overall_count;
      }
    });

    const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL = `
            SELECT
              COUNT(*) as overall_count,
              b.overall_status
            from 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            where
              b.overall_status IN ('completed','stopcheck','active employment','nil','not doable','candidate denied')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
              AND c.status=1
              AND CAST(a.branch_id AS CHAR) = ?
              AND a.is_deleted != 1
              AND c.is_deleted != 1
            GROUP BY
              b.overall_status
          `;
    console.log(`completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL - `, completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL);
    const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult = await sequelize.query(completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL, {
      replacements: [String(branch_id)], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult.forEach(row => {
      if (row.overall_status === 'completed') {
        filterOptions.previousCompletedCount = row.overall_count;
      } else if (row.overall_status === 'stopcheck') {
        filterOptions.stopcheckCount = row.overall_count;
      } else if (row.overall_status === 'active employment') {
        filterOptions.activeEmploymentCount = row.overall_count;
      } else if (row.overall_status === 'nil' || row.overall_status === '' || row.overall_status === null) {
        filterOptions.nilCount = row.overall_count;
      } else if (row.overall_status === 'not doable') {
        filterOptions.notDoableCount = row.overall_count;
      } else if (row.overall_status === 'candidate denied') {
        filterOptions.candidateDeniedCount = row.overall_count;
      }
    });

    const completedGreenRedYellowPinkOrangeSQL = `
              SELECT
              COUNT(*) as overall_count,
              b.overall_status
            from 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            where
              b.overall_status IN ('completed','stopcheck','active employment','nil','not doable','candidate denied')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
              AND c.status=1
              AND CAST(a.branch_id AS CHAR) = ?
              AND a.is_deleted != 1
              AND c.is_deleted != 1
            GROUP BY
              b.overall_status
            `;
    console.log(`completedGreenRedYellowPinkOrangeSQL - `, completedGreenRedYellowPinkOrangeSQL);
    const completedGreenRedYellowPinkOrangeResult = await sequelize.query(completedGreenRedYellowPinkOrangeSQL, {
      replacements: [String(branch_id)], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    completedGreenRedYellowPinkOrangeResult.forEach(row => {
      if (row.final_verification_status === 'GREEN') {
        filterOptions.completedGreenCount = row.overall_count;
      } else if (row.final_verification_status === 'RED') {
        filterOptions.completedRedCount = row.overall_count;
      } else if (row.final_verification_status === 'YELLOW') {
        filterOptions.completedYellowCount = row.overall_count;
      } else if (row.final_verification_status === 'PINK') {
        filterOptions.completedPinkCount = row.overall_count;
      } else if (row.final_verification_status === 'ORANGE') {
        filterOptions.completedOrangeCount = row.overall_count;
      }
    });
    return callback(null, filterOptions);
  },

  getCMTApplicationById: async (client_application_id, callback) => {

    // Fetch holidays
    const holidaysQuery = `SELECT id AS holiday_id, title AS holiday_title, date AS holiday_date FROM holidays;`;
    const holidayResults = await sequelize.query(holidaysQuery, { type: QueryTypes.SELECT });

    // Prepare holiday dates for calculations
    const holidayDates = holidayResults.map(holiday => moment(holiday.holiday_date).startOf("day"));

    // Fetch weekends
    const weekendsQuery = `SELECT weekends FROM company_info WHERE status = 1;`;
    const weekendResults = await sequelize.query(weekendsQuery, { type: QueryTypes.SELECT });

    const weekends = weekendResults[0]?.weekends ? JSON.parse(weekendResults[0].weekends) : [];
    const weekendsSet = new Set(weekends.map(day => day.toLowerCase()));

    const now = new Date();
    const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

    const sql = `
      SELECT cmt.*, cm.tat_days 
      FROM \`cmt_applications\` cmt
      LEFT JOIN \`customer_metas\` cm ON cm.customer_id = cmt.customer_id
      WHERE cmt.\`client_application_id\` = ?
    `;

    try {
      const results = await sequelize.query(sql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

      // Format results
      const formattedResults = results.map((result, index) => {
        return {
          ...result,
          deadline_date: calculateDueDate(
            moment(result.created_at),
            result.tat_days,
            holidayDates,
            weekendsSet
          )
        };
      });

      // Return the first result or null if not found
      callback(null, formattedResults.length > 0 ? formattedResults[0] : null);
    } catch (error) {
      // If there's an error, pass it to the callback
      callback(error);
    }
  },


  getCMTApplicationIDByClientApplicationId: async (
    client_application_id,
    callback
  ) => {
    if (!client_application_id) {
      return callback(null, false);
    }

    const sql =
      "SELECT `id` FROM `cmt_applications` WHERE `client_application_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [client_application_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length > 0) {
      return callback(null, results[0].id);
    }
    callback(null, false);


  },

  getCMTAnnexureByApplicationId: async (
    client_application_id,
    db_table,
    callback
  ) => {

    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?`;

    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [process.env.DB_NAME, db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (tableResults[0].count === 0) {
      const createTableSql = `
              CREATE TABLE \`${db_table}\` (
                \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
                \`cmt_id\` bigint(20) DEFAULT NULL,
                \`client_application_id\` bigint(20) NOT NULL,
                \`branch_id\` int(11) NOT NULL,
                \`customer_id\` int(11) NOT NULL,
                \`status\` VARCHAR(100) DEFAULT NULL,
                \`team_management_docs\` LONGTEXT DEFAULT NULL,
                \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (\`id\`),
                KEY \`client_application_id\` (\`client_application_id\`),
                KEY \`cmt_application_customer_id\` (\`customer_id\`),
                KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
                CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
                CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
                CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });

      fetchData();

    } else {
      fetchData();
    }

    async function fetchData() {
      const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;

      const results = await sequelize.query(sql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      const response = results.length > 0 ? results[0] : null;
      callback(null, response);

    }


  },

  reportFormJsonByServiceID: async (service_id, callback) => {
    const sql = "SELECT `json` FROM `report_forms` WHERE `service_id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [service_id],
      type: QueryTypes.SELECT,
    });
    callback(null, results[0] || null);


  },

  generateReport: async (
    mainJson,
    client_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    Object.keys(mainJson).forEach((field) => {
      if (mainJson[field] === null || mainJson[field] === '' || mainJson[field] === undefined) {
        mainJson[field] = null;
      }
    });

    const fields = Object.keys(mainJson).map((field) => field.toLowerCase());

    const checkColumnsSql = `SHOW COLUMNS FROM \`cmt_applications\``;

    const results = await sequelize.query(checkColumnsSql, {
      type: QueryTypes.SELECT,
    });

    const existingColumns = results.map((row) => row.Field);

    const missingColumns = fields.filter(
      (field) => !existingColumns.includes(field)
    );

    // 2. Add missing columns if any
    const addMissingColumns = () => {
      if (missingColumns.length > 0) {
        const alterQueries = missingColumns.map((column) => {
          return `ALTER TABLE cmt_applications ADD COLUMN ${column} LONGTEXT`;
        });

        // Run all ALTER statements sequentially
        const alterPromises = alterQueries.map(

          (query) =>
            new Promise((resolve, reject) => {
              connection.query(query, (alterErr) => {
                if (alterErr) {
                  console.error("Error adding column:", alterErr);
                  return reject(alterErr);
                }
                resolve();
              });
            })
        );

        return Promise.all(alterPromises);
      }
      return Promise.resolve(); // No missing columns, resolve immediately
    };

    // 3. Check if entry exists by client_application_id and insert/update accordingly
    const checkAndUpsertEntry = async () => {
      const checkEntrySql =
        "SELECT * FROM cmt_applications WHERE client_application_id = ?";
      const entryResults = await sequelize.query(checkEntrySql, {
        replacements: [client_application_id], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });
      mainJson.branch_id = branch_id;
      mainJson.customer_id = customer_id;

      if (entryResults.length > 0) {

        // Get keys (indexes) and values (although you're not really using them in this case)
        const indexes = Object.keys(mainJson);
        const values = Object.values(mainJson);

        // Prepare the update query
        const updateSql = `UPDATE cmt_applications SET ${indexes.map(key => `${key} = ?`).join(', ')} WHERE client_application_id = ?`;

        // Insert the values into the query and include the client_application_id at the end
        const updateResult = await sequelize.query(updateSql, {
          replacements: [...Object.values(mainJson), client_application_id],
          type: QueryTypes.UPDATE,
        });


        callback(null, updateResult);

      } else {
        // Insert new entry
        const insertSql = "INSERT INTO cmt_applications SET ?";
        const insertResult = await sequelize.query(insertSql, {
          replacements: { ...mainJson, client_application_id, branch_id, customer_id, }, // Positional replacements using ?
          type: QueryTypes.INSERT,
        });
        callback(null, insertResult);
      }


    };

    // Execute the operations in sequence
    addMissingColumns()
      .then(() => checkAndUpsertEntry())
      .catch((err) => {
        console.error("Error during ALTER or entry check:", err);
        callback(err, null);
      });


  },

  createOrUpdateAnnexure: async (
    cmt_id,
    client_application_id,
    branch_id,
    customer_id,
    db_table,
    mainJson,
    callback
  ) => {
    try {
      const fields = Object.keys(mainJson);
      // Check if the table exists
      const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?`;

      const tableResults = await sequelize.query(checkTableSql, {
        replacements: [process.env.DB_NAME || "goldquest", db_table],
        type: QueryTypes.SELECT,
      });

      if (tableResults[0].count === 0) {
        const createTableSql = `
        CREATE TABLE \`${db_table}\` (
          \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
          \`cmt_id\` bigint(20) DEFAULT NULL,
          \`client_application_id\` bigint(20) NOT NULL,
          \`branch_id\` int(11) NOT NULL,
          \`customer_id\` int(11) NOT NULL,
          \`status\` VARCHAR(100) DEFAULT NULL,
          \`team_management_docs\` LONGTEXT DEFAULT NULL,
          \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`client_application_id\` (\`client_application_id\`),
          KEY \`cmt_application_customer_id\` (\`customer_id\`),
          KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
          CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

        await sequelize.query(createTableSql, { type: QueryTypes.RAW });
      }

      // Check if all required columns exist
      const checkColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const results = await sequelize.query(checkColumnsSql, { type: QueryTypes.SELECT });

      const existingColumns = results.map((row) => row.Field);
      const missingColumns = fields.filter((field) => !existingColumns.includes(field));

      if (missingColumns.length > 0) {
        await Promise.all(
          missingColumns.map(async (column) => {
            const alterTableSql = `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`;
            return sequelize.query(alterTableSql, { type: QueryTypes.RAW });
          })
        );
      }

      // Check if the entry exists
      const checkEntrySql = `SELECT * FROM \`${db_table}\` WHERE client_application_id = ?`;
      const entryResults = await sequelize.query(checkEntrySql, {
        replacements: [client_application_id],
        type: QueryTypes.SELECT,
      });

      if (entryResults.length > 0) {
        // Update existing entry
        const updateSql = `UPDATE \`${db_table}\` SET ${Object.keys(mainJson)
          .map((key) => `\`${key}\` = ?`)
          .join(", ")} WHERE client_application_id = ?`;

        const updateResult = await sequelize.query(updateSql, {
          replacements: [...Object.values(mainJson), client_application_id],
          type: QueryTypes.UPDATE,
        });

        callback(null, { message: "Updated successfully" });
      } else {
        // Insert new entry
        const insertSql = `INSERT INTO \`${db_table}\` (${Object.keys(mainJson)
          .concat(["client_application_id", "branch_id", "customer_id", "cmt_id"])
          .map((key) => `\`${key}\``)
          .join(", ")}) VALUES (${Object.keys(mainJson)
            .concat(["client_application_id", "branch_id", "customer_id", "cmt_id"])
            .map(() => "?")
            .join(", ")})`;

        await sequelize.query(insertSql, {
          replacements: [...Object.values(mainJson), client_application_id, branch_id, customer_id, cmt_id],
          type: QueryTypes.RAW,
        });

        callback(null, { message: "Inserted successfully" });
      }
    } catch (error) {
      console.error("Error in createOrUpdateAnnexure:", error);
      callback(error, null);
    }
  },


  upload: async (
    client_application_id,
    db_table,
    db_column,
    savedImagePaths,
    callback
  ) => {
    const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;
    const tableResults = await sequelize.query(checkTableSql, {
      replacements: [db_table], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (tableResults[0].count === 0) {
      const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
              \`cmt_id\` bigint(20) DEFAULT NULL,
              \`client_application_id\` bigint(20) NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` VARCHAR(100) DEFAULT NULL,
              \`team_management_docs\` LONGTEXT DEFAULT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`client_application_id\` (\`client_application_id\`),
              KEY \`cmt_application_customer_id\` (\`customer_id\`),
              KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
              CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
      await sequelize.query(createTableSql, {
        type: QueryTypes.CREATE,
      });
      proceedToCheckColumns();

    } else {
      proceedToCheckColumns();
    }

    async function proceedToCheckColumns() {
      const currentColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;
      const results = await sequelize.query(currentColumnsSql, {
        type: QueryTypes.SELECT,
      });

      const existingColumns = results.map((row) => row.Field);
      const expectedColumns = [db_column];

      // Filter out missing columns
      const missingColumns = expectedColumns.filter(
        (field) => !existingColumns.includes(field)
      );

      const addColumnPromises = missingColumns.map((column) => {
        return new Promise(async (resolve, reject) => {
          const alterTableSql = `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`;
          await sequelize.query(sql, {
            type: QueryTypes.RAW,
          });
          resolve();
        });
      });

      Promise.all(addColumnPromises)
        .then(async () => {
          const insertSql = `UPDATE \`${db_table}\` SET \`${db_column}\` = ? WHERE \`client_application_id\` = ?`;
          const joinedPaths = savedImagePaths.join(", ");
          const results = await sequelize.query(insertSql, {
            replacements: [joinedPaths, client_application_id], // Positional replacements using ?
            type: QueryTypes.UPDATE,
          });

          callback(true, results);

        })
        .catch((columnErr) => {

          console.error("Error adding columns:", columnErr);
          callback(false, {
            error: "Error adding columns.",
            details: columnErr,
          });
        });

    }


  },

  getAttachmentsByClientAppID: async (client_application_id, callback) => {
    if (typeof callback !== "function") {
      console.error("Callback is not a function");
      return;
    }

    try {
      // Step 1: Get `services` from `client_applications`
      const sql = "SELECT `services` FROM `client_applications` WHERE `id` = ?";
      const results = await sequelize.query(sql, {
        replacements: [client_application_id],
        type: QueryTypes.SELECT,
      });

      if (results.length === 0) {
        return callback(null, []); // No services found, return empty array
      }

      const services = results[0].services.split(","); // Split services by comma
      const dbTableFileInputs = {}; // Object to store db_table and file inputs

      // Step 2: Fetch `json` for each service from `report_forms`
      const serviceQueries = services.map(async (service) => {
        const query = "SELECT `json` FROM `report_forms` WHERE `id` = ?";
        const result = await sequelize.query(query, {
          replacements: [service],
          type: QueryTypes.SELECT,
        });

        if (result.length > 0) {
          try {
            const jsonData = JSON.parse(result[0].json);
            const dbTable = jsonData.db_table;

            if (!dbTableFileInputs[dbTable]) {
              dbTableFileInputs[dbTable] = [];
            }

            // Extract file input names
            jsonData.rows.forEach((row) => {
              row.inputs.forEach((input) => {
                if (input.type === "file") {
                  dbTableFileInputs[dbTable].push(input.name);
                }
              });
            });
          } catch (parseErr) {
            console.error("Error parsing JSON for service:", service, parseErr);
          }
        }
      });

      await Promise.all(serviceQueries); // Wait for all service queries to complete

      // Step 3: Fetch the `host`
      const hostSql = `SELECT \`host\` FROM \`app_info\` WHERE \`status\` = 1 AND \`interface_type\` = ? ORDER BY \`updated_at\` DESC LIMIT 1`;
      const hostResults = await sequelize.query(hostSql, {
        replacements: ["backend"],
        type: QueryTypes.SELECT,
      });

      const host = hostResults.length > 0 ? hostResults[0].host : "www.example.com"; // Fallback host

      // Step 4: Fetch file attachments from each table
      let finalAttachments = [];
      const tableQueries = Object.entries(dbTableFileInputs).map(async ([dbTable, fileInputNames]) => {

        // Check if table exists
        const tableExistsSql = `
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = ?`;

        const [tableExistsResult] = await sequelize.query(tableExistsSql, {
          replacements: [dbTable],
          type: QueryTypes.SELECT,
        });

        if (tableExistsResult.count === 0) {
          console.warn(`Table "${dbTable}" does not exist.`);
          return;
        }

        // 1. Check for existing columns in cmt_applications
        const checkColumnsSql = `SHOW COLUMNS FROM \`${dbTable}\``;
        const [results] = await sequelize.query(checkColumnsSql, { type: QueryTypes.SHOW });

        const existingColumns = results.map((row) => row.Field);
        const existingColumnsFromFileInoutNames = fileInputNames.filter((field) => existingColumns.includes(field));

        const selectQuery = `SELECT ${existingColumnsFromFileInoutNames.length > 0 ? existingColumnsFromFileInoutNames.join(", ") : "*"} FROM ${dbTable} WHERE client_application_id = ?`;
        const rows = await sequelize.query(selectQuery, {
          replacements: [client_application_id],
          type: QueryTypes.SELECT,
        });

        rows.forEach((row) => {
          Object.values(row)
            .filter((value) => value) // Remove falsy values
            .join(",")
            .split(",")
            .forEach((attachment) => {
              finalAttachments.push(`${attachment}`);
            });
        });
      });

      await Promise.all(tableQueries); // Wait for all table queries to complete

      // Step 5: Return final attachments
      callback(null, finalAttachments.join(", "));

    } catch (error) {
      console.error("Database query error:", error);
      callback({ status: false, message: "Internal Server Error" }, null);
    }
  },

  updateReportDownloadStatus: async (id, callback) => {
    const sql = `
      UPDATE client_applications
      SET is_report_downloaded = 1
      WHERE id = ?
    `;

    /*
    const sql = `
      UPDATE client_applications ca
      JOIN cmt ON ca.id = cmt.client_application_id
      SET ca.is_report_downloaded = 1
      WHERE 
        ca.id = ? 
        AND cmt.report_date IS NOT NULL
        AND TRIM(cmt.report_date) != '0000-00-00'
        AND TRIM(cmt.report_date) != ''
        AND cmt.overall_status IN ('complete', 'completed')
        AND (cmt.is_verify = 'yes' OR cmt.is_verify = 1 OR cmt.is_verify = '1');
    `;
    */

    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  updateDataQC: async (data, callback) => {
    const { application_id, data_qc } = data;

    const sql = `
        UPDATE \`client_applications\` 
        SET 
          \`is_data_qc\` = ?
        WHERE \`id\` = ?
      `;

    const results = await sequelize.query(sql, {
      replacements: [data_qc, application_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);

  },
};

module.exports = Customer;
