"""Builds the PDF and Excel monthly reports from a plain dictionary.
No Django in this file, so it is easy to test on its own."""
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

COBALT = colors.HexColor('#2d5bff')
INK = colors.HexColor('#15203a')
LIGHT = colors.HexColor('#eef2ff')
GREY = colors.HexColor('#6b7280')


def money(value, currency):
    return f'{currency} {value:,.2f}'


def build_pdf(data):
    """data: see reports.collect_report_data()"""
    currency = data['currency']
    styles = getSampleStyleSheet()
    title = ParagraphStyle('t', parent=styles['Title'], textColor=INK, alignment=0, fontSize=22)
    sub = ParagraphStyle('s', parent=styles['Normal'], textColor=GREY, fontSize=10)
    h2 = ParagraphStyle('h', parent=styles['Heading2'], textColor=COBALT, spaceBefore=14, spaceAfter=6)
    body = ParagraphStyle('b', parent=styles['Normal'], fontSize=9)

    def table(rows, widths, right_cols=()):
        t = Table(rows, colWidths=widths, repeatRows=1)
        style = [
            ('BACKGROUND', (0, 0), (-1, 0), COBALT),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]
        for col in right_cols:
            style.append(('ALIGN', (col, 0), (col, -1), 'RIGHT'))
        t.setStyle(TableStyle(style))
        return t

    story = [
        Paragraph('BudgetBuddy monthly report', title),
        Paragraph(f"{data['month_label']} &nbsp;|&nbsp; Account: {data['username']}", sub),
        Spacer(1, 10),
    ]

    # Summary
    rate = data['savings_rate']
    summary = [
        ['Total income', money(data['income_total'], currency)],
        ['Total expenses', money(data['expense_total'], currency)],
        ['Balance', money(data['balance'], currency)],
        ['Savings rate', f'{rate}%' if rate is not None else 'No income recorded'],
    ]
    story += [Paragraph('Summary', h2), table([['Item', 'Amount']] + summary, [80 * mm, 60 * mm], (1,))]

    # Categories
    story.append(Paragraph('Spending by category', h2))
    if data['categories']:
        rows = [['Category', 'Spent', 'Share']] + [
            [c['category'], money(c['total'], currency), f"{c['percent']}%"] for c in data['categories']]
        story.append(table(rows, [80 * mm, 45 * mm, 25 * mm], (1, 2)))
    else:
        story.append(Paragraph('No expenses recorded this month.', body))

    # Budgets
    story.append(Paragraph('Budgets', h2))
    if data['budgets']:
        rows = [['Budget', 'Limit', 'Spent', 'Used']] + [
            [b['name'], money(b['budget'], currency), money(b['spent'], currency), f"{b['percent']}%"]
            for b in data['budgets']]
        story.append(table(rows, [50 * mm, 45 * mm, 45 * mm, 25 * mm], (1, 2, 3)))
    else:
        story.append(Paragraph('No budgets were set for this month.', body))

    # Income by source
    story.append(Paragraph('Income by source', h2))
    if data['income_sources']:
        rows = [['Source', 'Received']] + [
            [s['source'], money(s['total'], currency)] for s in data['income_sources']]
        story.append(table(rows, [80 * mm, 60 * mm], (1,)))
    else:
        story.append(Paragraph('No income recorded this month.', body))

    # Expense history
    story.append(Paragraph('Expense history', h2))
    if data['expenses']:
        rows = [['Date', 'Category', 'Note', 'Amount']] + [
            [e['date'], e['category'], (e['description'] or '-')[:40], money(e['amount'], currency)]
            for e in data['expenses']]
        story.append(table(rows, [25 * mm, 40 * mm, 65 * mm, 40 * mm], (3,)))
    else:
        story.append(Paragraph('No expenses recorded this month.', body))

    buffer = BytesIO()

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(GREY)
        canvas.drawString(20 * mm, 10 * mm, 'BudgetBuddy')
        canvas.drawRightString(190 * mm, 10 * mm, f'Page {doc.page}')
        canvas.restoreState()

    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm,
                            title=f"BudgetBuddy report {data['month_label']}")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def build_xlsx(data):
    workbook = Workbook()
    header_fill = PatternFill('solid', start_color='2D5BFF')
    header_font = Font(bold=True, color='FFFFFF')
    number_format = '#,##0.00'

    def sheet(ws, headers, rows, widths, money_cols=(), total_col=None):
        ws.append(headers)
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(vertical='center')
        for row in rows:
            ws.append(row)
        for index, width in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(index)].width = width
        for col in money_cols:
            for cell in ws[get_column_letter(col)][1:]:
                cell.number_format = number_format
        if total_col and rows:
            last = len(rows) + 1
            letter = get_column_letter(total_col)
            ws.cell(row=last + 2, column=total_col - 1, value='Total').font = Font(bold=True)
            total = ws.cell(row=last + 2, column=total_col, value=f'=SUM({letter}2:{letter}{last})')
            total.font = Font(bold=True)
            total.number_format = number_format
        ws.freeze_panes = 'A2'

    # Summary
    ws = workbook.active
    ws.title = 'Summary'
    rate = data['savings_rate']
    sheet(ws, ['Item', 'Value'], [
        ['Month', data['month_label']],
        ['Account', data['username']],
        ['Currency', data['currency']],
        ['Total income', data['income_total']],
        ['Total expenses', data['expense_total']],
        ['Balance', data['balance']],
        ['Savings rate (%)', rate if rate is not None else 'No income'],
    ], [24, 22])
    for row in (5, 6, 7):
        ws.cell(row=row, column=2).number_format = number_format

    sheet(workbook.create_sheet('Expenses'), ['Date', 'Category', 'Note', 'Amount'],
          [[e['date'], e['category'], e['description'], e['amount']] for e in data['expenses']],
          [14, 22, 40, 16], money_cols=(4,), total_col=4)
    sheet(workbook.create_sheet('Income'), ['Date', 'Source', 'Note', 'Amount'],
          [[i['date'], i['source'], i['description'], i['amount']] for i in data['incomes']],
          [14, 22, 40, 16], money_cols=(4,), total_col=4)
    sheet(workbook.create_sheet('Categories'), ['Category', 'Spent', 'Share (%)'],
          [[c['category'], c['total'], c['percent']] for c in data['categories']],
          [26, 16, 12], money_cols=(2,))
    sheet(workbook.create_sheet('Budgets'), ['Budget', 'Limit', 'Spent', 'Used (%)'],
          [[b['name'], b['budget'], b['spent'], b['percent']] for b in data['budgets']],
          [26, 16, 16, 12], money_cols=(2, 3))

    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()