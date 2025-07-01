
const emailTemplate = (title="", emailimg="", heading="", subheading="",body="", company_name="") => {
  return `<!DOCTYPE html>
  <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Welcome Email</title>
  
    <link href="https://fonts.googleapis.com/css?family=Lato:300,400,700" rel="stylesheet">
  
    <style type="text/css">
      /* CSS Reset */
      html, body {
        margin: 0 auto !important;
        padding: 0 !important;
        height: 100% !important;
        width: 100% !important;
        background: #f1f1f1;
      }
  
      * {
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
      }
  
      table, td {
        mso-table-lspace: 0pt !important;
        mso-table-rspace: 0pt !important;
      }
  
      table {
        border-spacing: 0 !important;
        border-collapse: collapse !important;
        table-layout: fixed !important;
        margin: 0 auto !important;
      }
  
      img {
        -ms-interpolation-mode: bicubic;
      }
  
      a {
        text-decoration: none;
      }
  
      *[x-apple-data-detectors], .unstyle-auto-detected-links *, .aBn {
        border-bottom: 0 !important;
        cursor: default !important;
        color: inherit !important;
        text-decoration: none !important;
        font-size: inherit !important;
        font-family: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
      }
  
      .a6S {
        display: none !important;
        opacity: 0.01 !important;
      }
  
      .im {
        color: inherit !important;
      }
  
      img.g-img + div {
        display: none !important;
      }
  
      @media screen and (max-width: 500px) {
  
      }
      
      /* Custom Styles */
      body {
        font-family: Lato, sans-serif;
        font-weight: 400;
        font-size: 15px;
        line-height: 1.8;
        color: rgba(0, 0, 0, .4);
      }
  
      .bg_white {
        background: #ffffff;
      }
  
      .bg_light {
        background: #fafafa;
      }
  
      .text {
        padding: 0 2.5em;
        text-align: center;
      }
  
      .text h2 {
        color: #000;
        font-size: 40px;
        margin-bottom: 0;
        font-weight: 400;
        line-height: 1.4;
      }
  
      .text h3 {
        font-size: 20px;
        font-weight: 300;
        color: rgb(115, 111, 111);
      }
  
      .text h2 span {
        font-weight: 600;
        color: #1a253a;
      }
  
      .footer {
        border-top: 1px solid rgba(0, 0, 0, .05);
        color: rgba(0, 0, 0, .5);
      }
  
      .footer .heading {
        color: #000;
        font-size: 20px;
      }
  
      .footer ul {
        margin: 0;
        padding: 0;
      }
  
      .footer ul li {
        list-style: none;
        margin-bottom: 10px;
      }
  
      .footer ul li a {
        color: rgba(0, 0, 0, 1);
      }
    </style>
  </head>
  
  <body style="margin: 0; padding: 0 !important; mso-line-height-rule: exactly; background-color: #f1f1f1;">
    <center style="width: 100%; background-color: #f1f1f1;">
      <div style="display: none; font-size: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all; font-family: sans-serif;">
        &nbsp;
      </div>
      <div style="max-width: 600px; margin: 0 auto;" class="email-container">
        <!-- BEGIN BODY -->
        <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: auto;">
          <tr>
            <td valign="top" class="bg_white" style="padding: 1em 2.5em 0 2.5em;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td class="logo" style="text-align: center;">
                    <h1><a href="#" style="color: #c7a75a">${title}</a></h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Logo Section -->
  
          <tr>
            <td valign="middle" class="hero bg_white">
              <img src="${emailimg}" alt="" style="width: 200px; max-width: 600px; height: auto; margin: auto; display: block;">
            </td>
          </tr>
          <!-- Hero Image Section -->
  
          <tr>
            <td valign="middle" class="hero bg_white" style="padding: 0em 0 4em 0;">
              <table>
                <tr>
                  <td>
                    <div class="text">
                                          <h2>${heading}</h2>
                                          <h3>${subheading}</h3>
                                          ${body}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Text Section -->
  
          <tr>
            <tdvalign="middle" class="bg_light" style="text-align: center;">
              <p>© 2024 <a href="#" style="color: rgba(0,0,0,.8);">${company_name}</a>. All Rights Reserved.</p>
            </td>
          </tr>
        </table>
        <!-- Footer Section -->
      </div>
    </center>
  </body>
  </html>`

}


module.exports = emailTemplate