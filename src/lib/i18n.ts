// src/lib/i18n.ts
// Translation dictionary for Thai/English language support

export type Lang = 'th' | 'en';

export const translations = {
  // ===== HEADER =====
  appTitle: { th: 'ระบบติดตามสินเชื่อ', en: 'Loan Tracking' },
  appSubtitle: { th: 'แดชบอร์ดการเงินระดับมืออาชีพ', en: 'Professional financial dashboard & analytics' },
  syncingData: { th: 'กำลังซิงค์...', en: 'Syncing...' },
  withdraw: { th: 'เบิกเงิน', en: 'Withdraw' },
  newLoan: { th: 'เพิ่มลูกหนี้', en: 'New Loan' },

  // ===== METRIC CARDS =====
  totalPortfolio: { th: 'วงเงินทั้งหมด', en: 'Total Portfolio Size' },
  activeLimit: { th: 'วงเงินที่ปล่อยกู้', en: 'Active Limit' },
  netProfit: { th: 'กำไรสุทธิ', en: 'Net Profit' },
  margin: { th: 'อัตรากำไร', en: 'Margin' },
  nplRatio: { th: 'NPL / หนี้เสีย', en: 'NPL Ratio / Bad Debt' },
  lost: { th: 'สูญเสีย', en: 'Lost' },
  availableBalance: { th: 'ยอดว่าง', en: 'Available Balance' },
  readyToLend: { th: 'พร้อมปล่อยกู้', en: 'Ready to lend' },

  // ===== ALERTS SECTION =====
  dueToday: { th: 'ครบกำหนดวันนี้', en: 'DUE TODAY' },
  overdueAlerts: { th: 'แจ้งเตือนค้างชำระ', en: 'OVERDUE ALERTS' },
  noCollectionsToday: { th: 'ไม่มียอดนัดชำระวันนี้', en: 'No collections scheduled for today.' },
  noOverdueAccounts: { th: 'ไม่มีบัญชีค้างชำระ', en: 'No overdue accounts.' },
  daysOverdue: { th: 'วันที่ค้างชำระ', en: 'Days Overdue' },
  due: { th: 'ครบกำหนด', en: 'Due' },

  // ===== ANALYTICS =====
  portfolioAnalytics: { th: 'วิเคราะห์พอร์ตโฟลิโอ', en: 'Portfolio Analytics' },
  portfolioProgress: { th: 'ความคืบหน้า', en: 'Portfolio Progress' },
  clickForInsights: { th: 'กดเพื่อดูรายละเอียด', en: 'Click for Insights' },
  collected: { th: 'เก็บแล้ว', en: 'Collected' },
  remaining: { th: 'คงเหลือ', en: 'Remaining' },
  cashflowTrend: { th: 'แนวโน้มกระแสเงินสด (14 วัน)', en: 'Cashflow Trend (14 Days)' },
  clickToExpand: { th: 'กดเพื่อขยาย', en: 'Click to Expand' },
  expected: { th: 'คาดการณ์', en: 'Expected' },
  received: { th: 'รับจริง', en: 'Received' },
  trend30day: { th: 'แนวโน้ม 30 วัน', en: '30-Day Trend' },
  clickBarToViewDetails: { th: 'กดแท่งกราฟเพื่อดูรายละเอียด', en: 'Click any bar to view details' },

  // ===== DATA TABLE =====
  dataManagement: { th: 'จัดการข้อมูล', en: 'Data Management' },
  tabAll: { th: 'ทั้งหมด', en: 'All' },
  tabRenewals: { th: 'ต่อดอก', en: 'Renewals' },
  tabPaid: { th: 'ชำระแล้ว', en: 'Paid' },
  tabDefaulted: { th: 'โดนบิด', en: 'Defaulted' },
  tabWithdrawn: { th: 'เบิก', en: 'Withdrawn' },
  tabRaw: { th: 'ทั้งหมด (raw)', en: 'Raw' },
  customerId: { th: 'รหัสลูกค้า', en: 'Customer ID' },
  name: { th: 'ชื่อ', en: 'Name' },
  principal: { th: 'เงินต้น', en: 'Principal' },
  interestRate: { th: 'อัตราดอกเบี้ย', en: 'Interest Rate' },
  issueDate: { th: 'วันที่ยืม', en: 'Issue Date' },
  dueDate: { th: 'วันครบกำหนด', en: 'Due Date' },
  status: { th: 'สถานะ', en: 'Status' },

  // ===== LOAN DETAIL MODAL =====
  financialDetails: { th: 'รายละเอียดการเงิน', en: 'Financial Details' },
  paymentsAndDates: { th: 'การชำระและวันที่', en: 'Payments & Dates' },
  cancelEdit: { th: 'ยกเลิกแก้ไข', en: 'Cancel Edit' },
  editDetails: { th: '✏️ แก้ไข', en: '✏️ Edit Details' },
  expectedInterest: { th: 'ดอกเบี้ยที่คาดไว้', en: 'Expected Interest' },
  penaltyFee: { th: 'ค่าปรับ', en: 'Penalty Fee' },
  totalExpected: { th: 'ยอดรวมทั้งหมด', en: 'Total Expected' },
  newExpected: { th: 'ยอดรวมใหม่', en: 'New Expected' },
  totalPaid: { th: 'ยอดชำระทั้งหมด', en: 'Total Paid' },
  principalPaid: { th: 'ต้นที่จ่าย', en: 'Principal Paid' },
  interestPaid: { th: 'ดอกเบี้ยที่จ่าย', en: 'Interest Paid' },
  renewalHistory: { th: 'ประวัติต่อดอก (รอบปัจจุบัน)', en: 'Renewal History (Current Cycle)' },
  times: { th: 'ครั้ง', en: 'Times' },
  totalInterestAccumulated: { th: 'ดอกเบี้ยสะสมทั้งหมด', en: 'Total Interest Accumulated' },
  renewalNote: { th: 'ดอกเบี้ยที่ลูกค้าจ่ายเพื่อต่อดอกก่อนปิดยอด', en: 'Historical interest paid to extend this loan sequence before paying off principal.' },
  penaltyHistory: { th: 'ประวัติค่าปรับ', en: 'Penalty Payment History' },
  totalPenaltyPaid: { th: 'ยอดค่าปรับทั้งหมด', en: 'Total Penalty Paid' },
  round: { th: 'รอบที่', en: 'Round' },
  currentlyOverdue: { th: 'ปัจจุบันค้างชำระ', en: 'Currently' },
  daysOverdueText: { th: 'วัน', en: 'days overdue' },
  days: { th: 'วัน', en: 'Days' },
  actionDate: { th: 'วันที่ดำเนินการ:', en: 'Action Date:' },
  markPaid: { th: 'ชำระแล้ว', en: 'Paid' },
  renew: { th: 'ต่อดอก', en: 'Renew' },
  default: { th: 'โดนบิด', en: 'Default' },
  saveChanges: { th: '💾 บันทึก', en: '💾 Save Changes' },
  saving: { th: 'กำลังบันทึก...', en: 'Saving...' },

  // ===== STATUS BADGES =====
  statusPaid: { th: 'ชำระแล้ว', en: 'Paid' },
  statusRenewed: { th: 'ต่อดอก', en: 'Renewed' },
  statusDefaulted: { th: 'โดนบิด', en: 'Defaulted' },
  statusPayout: { th: 'เบิก', en: 'Payout' },
  statusActive: { th: 'กำลังกู้', en: 'Active' },
  statusOverdue: { th: 'ค้างชำระ', en: 'Overdue' },

  // ===== MODALS =====
  advancedCashflow: { th: 'วิเคราะห์กระแสเงินสดขั้นสูง', en: 'Advanced Cashflow Analytics' },
  cashflow30History: { th: 'ประวัติกระแสเงินสด 30 วัน', en: '30-Day Cashflow History & Daily Drill-down Insights' },
  noDateSelected: { th: 'ยังไม่ได้เลือกวันที่', en: 'No Date Selected' },
  selectDateOnGraph: { th: 'เลือกวันที่บนกราฟเพื่อดูรายละเอียด', en: 'Select a specific date on the graph to drill down into detailed collections.' },
  dailyInsightReport: { th: 'รายงานรายวัน', en: 'Daily Insight Report' },
  expectedInterestDue: { th: 'ดอกเบี้ยที่คาดว่าจะได้ (วันครบกำหนด)', en: 'Expected Interest (Due)' },
  actualPaymentsReceived: { th: 'ยอดชำระที่ได้รับจริง', en: 'Actual Payments Received' },
  noExpectedForDate: { th: 'ไม่มียอดดอกเบี้ยในวันนี้', en: 'No expected interest for this date.' },
  noPaymentsForDate: { th: 'ไม่มีการชำระในวันนี้', en: 'No actual payments for this date.' },

  // ===== NEW LOAN MODAL =====
  addNewLoan: { th: 'เพิ่มลูกหนี้ใหม่', en: 'Add New Loan' },
  borrowerName: { th: 'ชื่อผู้กู้', en: "Borrower's Name" },
  principalAmount: { th: 'จำนวนเงินกู้', en: 'Principal Amount' },
  borrowDate: { th: 'วันที่ยืม', en: 'Borrow Date' },
  dueDateLabel: { th: 'วันครบกำหนด', en: 'Due Date' },
  daysBorrowed: { th: 'จำนวนวัน', en: 'Days Borrowed' },
  interestRateLabel: { th: 'อัตราดอกเบี้ย (%)', en: 'Interest Rate (%)' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  addLoan: { th: 'เพิ่มรายการ', en: 'Add Loan' },

  // ===== WITHDRAW MODAL =====
  recordWithdrawal: { th: 'บันทึกการเบิกเงิน', en: 'Record Withdrawal' },
  withdrawalName: { th: 'ชื่อ/รายละเอียด (ไม่บังคับ)', en: 'Name/Note (optional)' },
  withdrawalAmount: { th: 'จำนวนเงิน', en: 'Amount' },
  withdrawalDate: { th: 'วันที่เบิก', en: 'Withdrawal Date' },
  record: { th: 'บันทึก', en: 'Record' },

  // ===== NOTIFICATION MODAL =====
  notifTitle: { th: 'การแจ้งเตือน', en: 'Notifications' },
  notifEnabled: { th: '✅ การแจ้งเตือนเปิดอยู่', en: '✅ Notifications Enabled' },
  notifBlocked: { th: '🚫 ถูกบล็อคโดยระบบ', en: '🚫 Blocked by System' },
  notifDisabled: { th: '⭕ ยังไม่ได้เปิดการแจ้งเตือน', en: '⭕ Notifications Disabled' },
  notifEnabledDesc: { th: 'คุณจะได้รับแจ้งเตือนที่ 06:00 และ 16:00 น. ทุกวัน', en: 'You will receive alerts at 06:00 and 16:00 daily.' },
  notifBlockedDesc: { th: 'กรุณาเปิดสิทธิ์ใน Settings > Safari > Notifications', en: 'Enable in Settings > Safari > Notifications' },
  notifDisabledDesc: { th: 'กดปุ่มด้านล่างเพื่อเริ่มรับการแจ้งเตือน', en: 'Tap the button below to enable notifications.' },
  morningAlert: { th: 'สรุปยอดนัดชำระและยอดค้างชำระ', en: 'Daily due summary & overdue accounts' },
  afternoonAlert: { th: 'แจ้งเตือนทวงยอดที่ยังไม่ชำระวันนี้', en: "Reminder for today's unpaid accounts" },
  enableNotif: { th: 'เปิดรับการแจ้งเตือน', en: 'Enable Notifications' },
  disableNotif: { th: 'ปิดการแจ้งเตือน', en: 'Disable Notifications' },
  testNotif: { th: 'ทดสอบการแจ้งเตือน', en: 'Test Notifications' },
  testMorning: { th: '🌅 ทดสอบ 06:00', en: '🌅 Test 06:00' },
  testAfternoon: { th: '🔔 ทดสอบ 16:00', en: '🔔 Test 16:00' },
  enableFirstToTest: { th: 'เปิดการแจ้งเตือนก่อนเพื่อทดสอบ', en: 'Enable notifications first to test' },

  // ===== TOAST / SYSTEM =====
  notifSuccess: { th: 'เปิดการแจ้งเตือนสำเร็จ! 🔔', en: 'Notifications Enabled! 🔔' },
  notifFailed: { th: 'ไม่สามารถเปิดการแจ้งเตือนได้ ตรวจสอบสิทธิ์ใน Settings', en: 'Could not enable notifications. Check Settings.' },
  notifDisabledToast: { th: 'ปิดการแจ้งเตือนแล้ว', en: 'Notifications disabled' },
  dataConnectionFailed: { th: 'ไม่สามารถเชื่อมต่อข้อมูลได้', en: 'Data Connection Failed' },
  failedToSync: { th: 'ไม่สามารถดึงข้อมูลล่าสุดได้', en: 'Failed to sync with the central database.' },
  loanAddedSuccess: { th: 'เพิ่มลูกหนี้สำเร็จ!', en: 'New loan added successfully!' },
  loanAddedFailed: { th: 'ไม่สามารถเพิ่มรายการได้', en: 'Failed to add new loan.' },
  withdrawalSuccess: { th: 'บันทึกการเบิกสำเร็จ!', en: 'Withdrawal recorded successfully!' },
  withdrawalFailed: { th: 'ไม่สามารถบันทึกการเบิกได้', en: 'Failed to record withdrawal.' },
  loanUpdated: { th: 'อัปเดตข้อมูลสำเร็จ', en: 'Loan details updated' },
  loanUpdateFailed: { th: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', en: 'Failed to save changes.' },
  sheetsUpdateFailed: { th: 'เกิดข้อผิดพลาดในการอัปเดต Google Sheets', en: 'Error updating Google Sheets.' },

  // ===== MOBILE NAV =====
  navDashboard: { th: 'หน้าหลัก', en: 'Dashboard' },
  navAlerts: { th: 'แจ้งเตือน', en: 'Alerts' },
  navCalendar: { th: 'ปฏิทิน', en: 'Calendar' },
  navLoans: { th: 'รายการ', en: 'Loans' },
  navAnalytics: { th: 'วิเคราะห์', en: 'Analytics' },

  // ===== PORTFOLIO INSIGHTS =====
  portfolioInsights: { th: 'รายละเอียดความคืบหน้าพอร์ต', en: 'Portfolio Progress Insights' },
  portfolioInsightsDesc: { th: 'รายละเอียดข้อมูลรายรับที่คาดหวังเทียบกับที่เก็บได้จริง', en: 'Detailed breakdown of expected vs. collected returns.' },
  totalExpectedValue: { th: 'มูลค่าคาดหวังรวม', en: 'Total Expected Value' },
  totalCollected: { th: 'ยอดเก็บได้รวม', en: 'Total Collected' },
  principalLentOut: { th: 'เงินต้นที่ปล่อยกู้ทั้งหมด', en: 'Total Principal Lent Out' },
  principalCollected: { th: 'เงินต้นที่เก็บได้แล้ว', en: 'Principal Collected' },
  principalRemaining: { th: 'เงินต้นคงค้าง / กำลังกู้', en: 'Principal Remaining / Active' },
  principalLost: { th: 'เงินต้นที่สูญเสีย (โดนบิด)', en: 'Principal Defaulted (Lost)' },
  interestExpected: { th: 'ดอกเบี้ยคาดหวังทั้งหมด', en: 'Total Interest Expected' },
  interestCollected: { th: 'ดอกเบี้ยที่เก็บได้แล้ว', en: 'Interest Collected' },
  interestRemaining: { th: 'ดอกเบี้ยคงค้าง / กำลังกู้', en: 'Interest Remaining / Active' },
  interestBreakdown: { th: 'รายละเอียดดอกเบี้ย', en: 'Interest Breakdown' },
  principalBreakdown: { th: 'รายละเอียดเงินต้น', en: 'Principal Breakdown' },

  // ===== EXTRA MODAL STRINGS =====
  newPayout: { th: 'บันทึกการเบิกเงินใหม่', en: 'New Payout (Withdrawal)' },
  payoutAmount: { th: 'จำนวนเงินที่เบิก', en: 'Payout Amount' },
  confirmPayout: { th: 'ยืนยันการเบิก', en: 'Confirm Payout' },
  issueNewLoan: { th: 'ออกยอดใหม่', en: 'Issue New Loan' },
};

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}
