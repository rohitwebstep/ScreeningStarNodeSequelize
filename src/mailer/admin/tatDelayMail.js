const nodemailer = require("nodemailer");
const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");

// Function to generate an HTML table from branch details
const generateTable = (customers) => {
  let table = "";
  let serialNumber = 1;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  customers.forEach((customer) => {
    if (customer.branches && Array.isArray(customer.branches)) {
      customer.branches.forEach((branch) => {
        if (branch.applications && Array.isArray(branch.applications)) {
          branch.applications.forEach((application) => {
            const formattedDate = formatDate(application.application_created_at);
            table += `<tr>
                        <td style='border:1px solid black;'>${serialNumber++}</td>
                        <td style='border:1px solid black;'>${application.application_id}</td>
                        <td style='border:1px solid black;'>${formattedDate}</td>
                        <td style='border:1px solid black;'>${application.application_name ?? "-"}</td>
                        <td style='border:1px solid black;'>${application.days_out_of_tat}</td>
                      </tr>`;
          });
        }
      });
    }
  });

  return table;
};

async function tatDelayMail(mailModule, action, applications, toArr = [], ccArr = []) {
  try {
    // console.log("📩 Preparing to send TAT delay mail...");

    // Fetch email template
    const [email] = await sequelize.query(
      "SELECT * FROM emails WHERE module = ? AND action = ? AND status = 1",
      {
        replacements: [mailModule, action],
        type: QueryTypes.SELECT,
      }
    );
    if (!email) throw new Error("Email template not found");

    // Fetch SMTP credentials
    const [smtp] = await sequelize.query(
      "SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1'",
      {
        replacements: [mailModule, action],
        type: QueryTypes.SELECT,
      }
    );
    if (!smtp) throw new Error("SMTP credentials not found");

    // Setup mail transporter
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure, // true for 465
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    // Generate HTML table
    const table = generateTable(applications);

    // Replace placeholders
    let template = email.template.replace(/{{table_rows}}/g, table);

    // Prepare TO recipients (parsed from applications)
    const extractedToArr = applications.flatMap((customer) => {
      try {
        const emails = JSON.parse(customer.customer_emails);
        return emails.map((email) => ({
          name: customer.customer_name,
          email: email.trim(),
        }));
      } catch (e) {
        console.error("⚠️ Failed to parse customer_emails for:", customer.customer_name, e);
        return [];
      }
    });

    const finalToArr = toArr.length ? toArr : extractedToArr;
    const recipientList = finalToArr.map((cust) => `"${cust.name}" <${cust.email}>`);

    // Prepare CC recipients
    const ccList = ccArr
      .flatMap((entry) => {
        try {
          let emails = [];
          if (Array.isArray(entry.email)) {
            emails = entry.email;
          } else if (typeof entry.email === "string") {
            let cleaned = entry.email.trim().replace(/\\"/g, '"').replace(/^"|"$/g, "");
            emails = cleaned.startsWith("[") ? JSON.parse(cleaned) : [cleaned];
          }
          return emails.map((e) => `"${entry.name}" <${e.trim()}>`);
        } catch (err) {
          console.error("⚠️ Failed parsing CC entry:", entry, err);
          return [];
        }
      })
      .filter(Boolean)
      .join(", ");

    // Send the email
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: recipientList.join(", "),
      cc: ccList || undefined,
      subject: email.title,
      html: template,
    });

    console.log("✅ Email sent successfully:", info.response);
  } catch (error) {
    console.error("❌ Error sending TAT delay mail:", error.message);
  }
}

module.exports = { tatDelayMail };
