'use client'
// HAZIRA-PROJPLANS-V11
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function fmtDay(ds) {
  if (!ds) return 'ללא תאריך'
  const [y, m, d] = String(ds).split('-').map(Number)
  if (!y || !m || !d) return 'ללא תאריך'
  const dt = new Date(y, m - 1, d)
  return 'יום ' + HE_DAYS[dt.getDay()] + ' · ' + d + ' ' + HE_MONTHS[m - 1]
}

function fmtShort(ds) {
  if (!ds) return '—'
  const [y, m, d] = String(ds).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return d + '/' + m
}

function todayISO() {
  const t = new Date()
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0')
}

const PLAN_STATUSES = [
  { value: 'draft',  label: 'טיוטה',  color: 'bg-gray-100 text-gray-600' },
  { value: 'active', label: 'פעיל',   color: 'bg-green-100 text-green-700' },
  { value: 'done',   label: 'הושלם',  color: 'bg-blue-100 text-blue-700' },
]
const getPlanStatus = v => PLAN_STATUSES.find(s => s.value === v) || PLAN_STATUSES[0]

// קטגוריית יום — צובעת את כותרת העמודה (פלטה מאופקת, באותו רגיסטר של הטורקיז)
const DAY_CATEGORIES = [
  { value: '',        label: '— יום —', head: '#B6CFD0', text: '#33414A' },
  { value: 'prep',    label: 'הכנות',   head: '#D8C7A8', text: '#5E4E30' },
  { value: 'rehears', label: 'חזרות',   head: '#AEC3D0', text: '#33495A' },
  { value: 'show',    label: 'מופע',    head: '#D3A9BE', text: '#6E2E4E' },
  { value: 'strike',  label: 'פירוק',   head: '#C3C6C9', text: '#40454A' },
]
const getDayCategory = v => DAY_CATEGORIES.find(c => c.value === (v || '')) || DAY_CATEGORIES[0]

// עמודות ממוינות כרונולוגית לפי תאריך (ריק — בסוף)
function sortColsByDate(arr) {
  return [...arr].sort((a, b) => String(a.date || '9999-12-31').localeCompare(String(b.date || '9999-12-31')))
}

// textarea שגדל לפי התוכן ועוטף שורות (במקום input שגולש)
function AutoTextarea({ value, onChange, onBlur, placeholder, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder}
      className={'resize-none overflow-hidden break-words leading-snug ' + (className || '')} />
  )
}

const HAZIRA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIyNDQuMjI5IiBoZWlnaHQ9IjI4NS4xNCIgdmlld0JveD0iMCAwIDI0NC4yMjkgMjg1LjE0Ij48Zz48Zz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSw1MS41MDc4LDE1Ny4yNDE3MikiIGQ9Ik0wIDBDMCAwIDE5LjYwNyAxNC4yMTMgMjcuMDE2IDE3LjczNyAzMy41NzUgMjAuODU3IDYwLjIyNyAzMC42NTEgNzQuMDIxIDMwLjIxNiA4Ni42OTEgMjkuODE2IDEwNi41MjEgMjMuMTIxIDExNi4zNjkgMTguMDU3IDEyOS44ODMgMTEuMTA5IDEzNi41NjMgNS4zMTQgMTQyLjc4My0uNDM4IDE0NS40MDEtMi44NiAxNDUuNzk3LTQuMjUzIDE0NS40MjkgLjU0NSAxNDQuOTggNi40MDMgMTQ1LjYzNiAxNy4zODggMTQ1LjQ3IDIzLjExNyAxNDUuNDAxIDI1LjUyMSAxNDQuNTc0IDMyLjI2NCAxNDQuMTMyIDMzLjc3IDE0Mi4wODUgNDAuNzU5IDEzNi45MzIgNTQuOTQyIDEzNi45MzIgNTQuOTQyIDEzNC45NzMgNjAuODY3IDEzNS4zODggNTAuNzkxIDEzNC42MzUgNDYuNzkxIDEzNC4yMjIgNDQuNiAxMzMuNTk4IDM5LjU2NyAxMzMuMzI4IDM3LjcyMiAxMzMuMDU3IDM1Ljg3NyAxMzEuOTMxIDMxLjQzOSAxMzEuMTU4IDI4LjE1MSAxMzAuMjA0IDI0LjA4OSAxMjkuNiAyNi45NzEgMTI5LjQ2MiAyOC41MzRMMTI3Ljk0NSA0NS44NDZDMTI3LjgwNyA0Ny40MDkgMTI3LjU3MSA0OS45NjcgMTI3LjQxOSA1MS41MjlMMTI1LjczMyA2OC45MTdDMTI1LjU4MiA3MC40NzkgMTI1LjE1IDczLjAwNCAxMjQuNzc0IDc0LjUyOEwxMTcuOTI4IDkzLjM2NUMxMTYuODQgOTcuMTMyIDExNi43ODEgOTQuMzg4IDExNi41MTEgOTMuMzc5IDExNi41MTEgOTMuMzc5IDExNi44MjMgODUuMTYzIDExNi4xMDIgODEuNjU2IDExNC43NjggNzUuMTcgMTEyLjQ4MiA2NC4xMzQgMTExLjcyMiA1OS43OTYgMTExLjM5MSA1Ny44OTkgMTEwLjcwOCA1NC44NSAxMDkuMjMgNTIuMDk1IDEwNy45MzkgNDkuNjg4IDEwNC42NDYgNDMuOTg3IDEwNC42NDYgNDMuOTg3IDEwMi44NTggNDAuOTAzIDEwMi45MTYgNDIuODE1IDEwMi42MjIgNDQuMzU2TDEwMS44NjIgNDguMzQzQzEwMS41NjkgNDkuODg1IDEwMS4zNyA1Mi40MzEgMTAxLjQyMiA1NEwxMDIuMDI1IDcyLjI5MUMxMDIuMDc3IDczLjg1OSAxMDEuOTUyIDc2LjQxNyAxMDEuNzQ3IDc3Ljk3M0w5Ny4yMzkgMTEyLjI2MUM5Ny4wMzYgMTEzLjgxOCA5Ni41MzMgMTE2LjMzMSA5Ni4xMjUgMTE3Ljg0Nkw4Ni4wNjggMTU0Ljk1N0M4NC43OTIgMTU5LjM4IDg0LjA2MyAxNTYuMjk0IDgzLjk5NyAxNTQuNzI3TDg0LjkyOCAxMTQuODdDODQuODYzIDExMy4zMDEgODQuNzg1IDExMC43MzQgODQuNzU3IDEwOS4xNjUgODQuNzU3IDEwOS4xNjUgODMuNDEzIDg0LjA0IDgzLjAwOSA3NS42ODUgODIuODQ0IDcyLjI3MSA4Mi42MTQgNzAuNzgyIDgyLjM2OCA2OS45MDRMNzcuNjg2IDUzLjk2N0M3Ny4xOTIgNTIuNDc2IDc2LjQ5NCA1Mi41MDYgNzYuMTMxIDU0LjAzM0w3NC44MDkgNTkuNjE0Qzc0LjQ0NiA2MS4xNDIgNzQuMTA2IDYzLjY3NSA3NC4wNTQgNjUuMjQ1TDczLjQ0NCA4My4yNEM3My4zOTIgODQuODA5IDczLjA3MSA4Ny4zNDcgNzIuNzMyIDg4Ljg3OUw2OS41OTggMTAzLjA4NkM2OS4yNTkgMTA0LjYxOSA2OC44ODEgMTA3LjE1NCA2OC43NTcgMTA4LjcxOSA2OC43NTcgMTA4LjcxOSA2Ni4yMTggMTM2LjAyMSA2Ni4wMiAxNDQuNzM0IDY1Ljk5MiAxNDUuOTIxIDY2LjM0NCAxNDkuMjY0IDY0LjcxNiAxNDUuMTMgNjQuNzE2IDE0NS4xMyA1NS43MzkgMTE5LjA0OSA1NC44ODcgMTE0LjM3IDU0LjAzNSAxMDkuNjkxIDUxLjgxMSA5MC4yOSA1MS44MTEgOTAuMjkgNTEuNzk2IDg4LjcyIDUxLjY0MiA4Ni4xNiA1MS40NyA4NC41OTlMNTAuMjcxIDczLjc1MkM1MC4wOTkgNzIuMTkyIDQ5Ljk3IDY5LjYzMSA0OS45ODYgNjguMDYyTDQ5Ljk4NCA0Ny4xOThDNTAuMDE4IDQ0LjIzNSA0OS44MDggNDQuNzA4IDQ4LjA1IDQ1Ljg1OSA0Ni45MDggNDYuNjA3IDQ1Ljc1NiA0OC42MTUgNDUuMzUzIDUwLjEzM0w0Mi4yMDQgNjEuNDA4QzQxLjggNjIuOTI1IDQxLjIzNiA2NS40MjggNDAuOTQ5IDY2Ljk3MkwzNy4yNjcgODYuNzU5QzM2Ljk3OSA4OC4zMDMgMzYuNjQ2IDkwLjg0NiAzNi41MjUgOTIuNDFMMzUuOTU1IDEwMy4yMjFDMzUuODM0IDEwNC43ODcgMzUuMzQ3IDEwNC44NDMgMzQuODczIDEwMy4zNDYgMzQuODczIDEwMy4zNDYgMjcuMTc3IDgxLjI5MiAyNS45MTcgNzUuMjA0IDI0LjY1OCA2OS4xMTYgMjMuNTA4IDU0LjQzMSAyMy41MDggNTQuNDMxIDIzLjQ3OCA1Mi44NiAyMy4yOTMgNTAuMzAyIDIzLjEgNDguNzQ2TDIxLjc3NiAzOC4xMzZDMjEuNTgyIDM2LjU3OCAyMS4wNjQgMzQuMDcxIDIwLjYyNiAzMi41NjNMMTguNTMyIDI3LjMzM0MxOC4wOTUgMjUuODI3IDE3LjExOCAyNS43MTkgMTYuMzYzIDI3LjA5NSAxNi4zNjMgMjcuMDk1IDE1LjA4NyAyNy43NjEgMTIuNzI2IDMzLjczMSAxMC4zNjUgMzkuNzAxIDExLjcxMyA1My40OTcgMTEuNzEzIDUzLjQ5NyAxMS43NjggNTUuOTUzIDExLjE0NCA1NS40MzcgMTAuMzM3IDUzLjQ3OSA5LjUzIDUxLjUyMSAyLjI1IDMzLjA5NSAuNTU3IDI2Ljg3NS0xLjEzNiAyMC42NTQtMi4xNDkgNC44My0yLjQyMyAxLjIyOC0yLjYzMy0xLjUyNi0zLjI4Mi0yLjYxNSAwIDAiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNDkuMDA5MiwyMTcuNjQ5NSkiIGQ9Ik0wIDBDLjQ5IDEuNDkxIDEuMzE2IDMuOTIzIDEuODQgNS40MDNMMS45OTQgNS44MzlDMi44MzggOC4zNDEgMy4xMzMgOC4wNzEgNC40OTIgNi4xMzNMNS4wMTMgNS4zMjdDNS44NjMgNC4wMDcgNy4zNzcgMS45MzcgOC4zNzUgLjcyNUwxMS44NjEtMy41MDdDMTMuNTc2LTUuODY3IDEzLjM0NC02LjI1NCAxNC43NjktMy4wNzRMMTkuNjUgOC42OTNDMjAuMjUyIDEwLjE0NCAyMS4wMTcgMTIuMjc0IDIxLjM1MSAxMy40MjkgMjEuNjg0IDE0LjU4MyAyMS45MyAxNS40MDkgMjQuMzgxIDE0LjAyMUwyNC41NDkgMTMuOTE3QzI1Ljg4MSAxMy4wODggMjcuNDM2IDExLjIxMiAyOC4wMDEgOS43NDlMMjkuMzA5IDYuMzcxQzI5Ljg3NSA0LjkwNiAyOS43ODEgMi42ODcgMzEuNzg5IDYuMTY3IDMxLjc4OSA2LjE2NyAzNC45NTMgMTEuNDI1IDM1LjU3NyAxMy4zNTkgMzYuMTU3IDE1LjE1NiAzNi4zNTcgMTcuMDE5IDM2LjU2NyAxOC41NzkgMzYuNTY3IDE4LjU3OSAzNi43MjggMjIuNDk2IDM2Ljc2MyAyMy44MSAzNi44MDUgMjUuMzggMzcuMzQ1IDI3Ljg4NSAzNy44MjQgMjkuMzc5TDM5LjAwOCAzMy4wNjFDMzkuOTEyIDM1LjI0NSA0MC4yNDcgMzUuNTUzIDM3LjY5MyAzMy45NDUgMzcuNjkzIDMzLjk0NSAyMy41MjIgMjMuMTI1IDE1Ljc5MSAyMC4xMTcgNC4yMjkgMTUuNjE2LTEzLjM2OSAxMS4wOC0yMy40OCA5Ljg2LTMwLjA5IDkuMDYyLTY2LjMwNSAxOS42NzQtNzEuMzAxIDIxLjU4Mi03Ni4zMzcgMjMuNTA1LTkxLjAxMiAzNC42NzktOTEuMDEyIDM0LjY3OS05My40ODcgMzYuNjgzLTkzLjExMSAzNi4yNjUtOTIuMTg4IDMzLjg0NUwtOTAuNDU2IDI5LjI3NkMtODkuOSAyNy44MDgtODkuNTE5IDI1LjMyNS04OS42MTEgMjMuNzU4TC04OS44MTUgMjAuMjg4Qy04OS45MDYgMTguNzIxLTg5LjY1IDE2LjE5OC04OS4yNDUgMTQuNjgxTC04Ny44NDggOS40NUMtODcuNDQyIDcuOTM1LTg3LjA3OSA2LjUzMi04NS45NDMgOS4yOTdMLTgzLjgwNiAxNC4wNjNDLTgzLjE2NCAxNS40OTUtODIuMDY3IDE3LjUwOC04MS4zNyAxOC41MzUtODAuNjc0IDE5LjU2Mi03OS44MiAxOS4xNDgtNzkuNDc1IDE3LjYxOEwtNzguMzUzIDEyLjYzNEMtNzguMDA4IDExLjEwMy03Ny4xOTIgOC42ODItNzYuNTQgNy4yNTRMLTcxLjc2LTMuMjIxQy03MC43NTgtNS4yMzEtNzAuNDc0LTUuNTM4LTY5Ljc5LTMuMDc0TC02OC4zODcgMS44MjdDLTY3Ljk1NSAzLjMzNi02Ni44MjEgNS41OTEtNjUuODY3IDYuODM3TC02NC4xMzQgOS4xQy02MS44MjYgMTIuNTQxLTYxLjcwOCAxMS4wMTMtNTkuNTg5IDguNTA4TC01Ny45MjEgNi4wMDRDLTU3LjA1MSA0LjY5Ny01NS45IDIuNDIxLTU1LjM2MyAuOTQ2TC01MS4zOTMtOS45NzVDLTUwLjcwNC0xMi4yNDYtNTEuMTc3LTE0LjIwNy00OC45NTYtMTAuMTQ0TC00NS41OC01LjIzN0MtNDQuNzIyLTMuOTIyLTQzLjQ0NC0xLjY5OS00Mi43MzktLjI5NkwtNDEuNjM3IDEuODk3Qy00MC45MzIgMy4yOTktMzguODUyIDQuMTM4LTM3LjU3MSAxLjkxNkwtMzYuNjk3IC4yMzhDLTM1Ljk3Mi0xLjE1NS0zNC4wNS00Ljc5LTMzLjM5Ny02LjU0My0zMi44NS04LjAxMy0zMS45NjktMTAuMjcyLTMxLjMwNC0xMS42OTRMLTI3LjYxMy0xOS4wMDNDLTI2LjU4OS0yMC42NDYtMjYuOTkxLTIzLjEwMy0yNS4zNDYtMTguOTM4TC0yMS40MjQtMTEuNDg2Qy0yMC44NDItMTAuMDI5LTE5LjgyMi01LjkwMS0xOS44MjItNS45MDEtMTguNjk2LTIuMzU5LTE4LjAzIDEuMzg4LTE3LjM5NCAxLjQxNy0xNi44NCAxLjQ0NC0xNC43NzUtMi4wMjItMTQuMDU0LTMuNjg4TC0xMy4zMzMtNS4xMThDLTEyLjgxMy02LjYtMTEuNjkyLTguODkyLTEwLjg0NC0xMC4yMTFMLTguNzE4LTEzLjUxMUMtNy4wMDEtMTYuMTY5LTcuMjA3LTE2LjY3LTUuOTM0LTEzLjM0TC0yLjMwNy01LjgyMUMtMS42MjQtNC40MDctLjY2NS0yLjAyOS0uMTc3LS41MzlaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMTAwLjA2NDksMTY3Ljg4OTcxKSIgZD0iTTAgMEMuMTQzIDguMzAxIDQuMTQyIDEyLjExMyA1LjYwNCAxMy43NSA5LjgwNCAxOC40NDYgMTUuNDIgMjEuNTE2IDIyLjAyNyAyMS41MTYgMjQuODU5IDIxLjUxNiAyNy40NzEgMjAuNzEgMzAuMDEzIDE5LjkxMyAzMy42MDQgMTguNzg2IDM0LjEwMiAxOC4zOTggMzQuNjI3IDE3LjgyNCAzNS4xMTMgMTcuMjkyIDM1LjU5OCAxNi40OTEgMzYuMjUxIDE1LjgxMyAzNi44MSAxNS4yMzEgMzcuMzYzIDE0LjY1IDM3LjkxMSAxNC4wNTkgMzguMDc0IDEzLjg4MyAzOC4yNTEgMTMuNzM1IDM4LjQwNiAxMy41OTUgNDEuMTczIDExLjExOSA0NC4yMjkgOC40IDQ0LjM4MiAwIDQ0LjUyLTcuNjM1IDM4LjM0My0xMy41MjQgMzguMzQzLTEzLjUyNCAzNy4yMDctMTQuNjA4IDM1Ljc2OS0xNi4xMSAzMy44OC0xNi44MDEgMzMuMTM3LTE3LjA3MyAzMS42MDQtMTcuNDg3IDMwLjg2OC0xNy43OCAyOC4xMDktMTguODc4IDI1LjM1OC0xOS44MjEgMjIuMTg5LTE5LjgyMSAyMi4wODctMTkuODIxIDIxLjc1NC0xOS44NTggMjEuMzk3LTE5Ljg1OCAyMS4wOTUtMTkuODU4IDE5LjQ1NC0xOS43OTEgMTguNTk3LTE5LjU4NyAxOC41OTctMTkuNTg3IDE3Ljk1NC0xOS40MzUgMTYuOTc2LTE5LjE0MiAxNS42NTQtMTguODA4IDE0LjM4Ni0xOC4zNSAxMy4xNzktMTcuNzc2IDExLjczNy0xNy4xNjEgMTAuMjYzLTE2LjM5OSA5LjExLTE1LjQ5MyAzLjkyNC0xMS40MTYtLjE2LTkuMjkyIDAgME0tNDkuMjUyLTEuNTgyQy00OS4yNTItMS41ODItMjYuMzk2LTE4LjMtMTcuMTM3LTIxLjg0NC03LjYzNS0yNS40ODEgMTYuMDIzLTMxLjM3IDI1LjQ1OS0zMS4zNTYgMzUuMDI1LTMxLjM0MSA1My43NTMtMjUuNjYyIDYyLjUyNS0yMS44NDQgNzEuMTE3LTE4LjEwNCA5NC42NDEtMS41ODIgOTQuNjQxLTEuNTgyIDk3LjQ1IC4xNTQgOTcuNTctLjU2NSA5NS4wMTQgMS4yMTRMOTMuNTY1IDIuMTY3QzkzLjU2NSAyLjE2NyA3NC41NjggMTUuOTI1IDY3LjY2NCAxOS41NTMgNTQuMTQyIDI2LjY1OSAyOC44ODEgMzEuOTYxIDIxLjc4OSAzMS45NTcgMTIuMjY0IDMxLjk1MS03Ljk3NCAyNC44NjItMTYuNzU5IDIxLjA3NS0yNS40NzcgMTcuMzE3LTQ5LjI1MiAxLjU4Mi00OS4yNTIgMS41ODItNTMuNTQzLS45NTktNTIuNzMgLjM4OS00OS4yNTItMS41ODIiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxMjIuMjQ3LDE3Ny43ODE4MikiIGQ9Ik0wIDBDNS44MTQgMCAxMC41NDIgNC43MyAxMC41NDIgMTAuNTQzIDEwLjU0MiAxNi4zNTYgNS44MTQgMjEuMDg1IDAgMjEuMDg1LTUuODEzIDIxLjA4NS0xMC41NDQgMTYuMzU2LTEwLjU0NCAxMC41NDMtMTAuNTQ0IDQuNzMtNS44MTMgMCAwIDAiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSw4MS44Mzc0LDI1MC4wMjA2MikiIGQ9Ik0wIDAtNS4zMS0yLjk2Mi0yLjM0Ny04LjI3MiAyLjk2Mi01LjMxWiIgZmlsbD0iIzJlMmQyYyIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDcxLjcxODIsMjc1LjAyMikiIGQ9Ik0wIDAgNy4xMjUtMS43OTQgMTEuMTA0IDE0Ljk3IDMuOTc5IDE2Ljc2NVoiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxODguMDk3MSwyNTEuMDIzMDEpIiBkPSJNMCAwIDUuMjYtMS45MTkgNS4zNzgtNy4xNTcgMTIuNDY0LTcuNDcxVi03LjQ1OEwxMi4yNzEgMi45NTggMi4xNTkgNi44NTVaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMTQ1Ljc4MTcsMjY5LjUxMjc0KSIgZD0iTTAgMCAyLjEyMy0xMS45MjkgMi4xMzYtMTEuOTI3IDkuNjE1LTEwLjYxMSA3LjQ5MSAxLjMxN1oiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNDMuNDEzNSwyNTguNDI4OCkiIGQ9Ik0wIDAgMS4zNDgtNy4yOTQgMTQuOTIxLTQuOTA4IDE3LjgzMy0yMC42NjcgMTcuODQ3LTIwLjY2NSAyNS4zMjUtMTkuMzQ5IDIxLjA2NCAzLjcwMloiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNjguMTM0MiwyNTMuNjc2ODIpIiBkPSJNMCAwIDEuMzcyLTcuMjMyIDExLjQzLTQuMzQgMTUuODI2LTE5LjczOCAxNS44MzktMTkuNzM0IDIyLjk1My0xNy43MDMgMTYuNTIxIDQuODIyWiIgZmlsbD0iIzJlMmQyYyIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDIxMy4zMzkzLDI0NS40NTcxMykiIGQ9Ik0wIDAtLjAwNSAuMDA4LTMuMjAzIDIuNzAzIDEuMTU0IDYuNDUxLTMuMTg3IDEyLjcwOC05LjQ3MiA2LjQ5OC0xNS41MjYgNC44MjgtMTAuNTMxLTEuMTQ0LTcuMjgyLS4zMDItMy4xMjMtMTUuNDM4IDMuNjIyLTExLjM4IDMuNjIxLTExLjM3MVoiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwyNi43MjYsMjI4LjIwMTIyKSIgZD0iTTAgMC01LjU4Mi02LjY0OS0xMC43NTEtMi4zMS01LjE2MSA0LjMyNS0xMC44MDQgOS4zODMtMjYuNzI2LTkuNTE0LTIxLjA4My0xNC41NzMtMTUuNDg1LTcuOTI4LTEwLjMwNi0xMi4yNzYtMTUuODg5LTE4LjkyNS05Ljk0OS0yMy42MjYgNS45MzktNC43MDJaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsNzIuOTU3NSwyNTAuNzUzMDIpIiBkPSJNMCAwLTkuMDE0IDItMTguNzQyIDcuNDUzLTIwLjkxNiAuNDE5LTEzLjYwOS0zLjc0NC0yNy43NjItMTUuODMzLTE3LjUxOC0xNy4yNS01LjI5NS0yMy4wNzgtMy42MTEtMTUuNzIyLTEyLjAyOC0xMS42MTVaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMjE5LjkwMTgsMjQwLjAzNzYyKSIgZD0iTTAgMCA2LjgzNS0xMC4wMDUgNi44NDctOS45OTggMTMuMTI1LTUuNzI3IDYuMjkgNC4yNzhaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMjMwLjg3ODQsMjE4Ljg3OTAyKSIgZD0iTTAgMC0xNy42ODctMTIuMDI1LTEzLjQ2Mi0xOC4xMjItMi4wNjUtMTAuMzczIDcuMDYxLTIzLjU0NiA3LjA3MS0yMy41MzkgMTMuMzUxLTE5LjI2OFoiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwzOS4xMzYyLDI1Mi42ODIyMikiIGQ9Ik0wIDAtNiAxLjUzIDEuMDExIDguMDQgMS41MTUgNy43ODRaTTYuMTU2LTEuNzEyIDkuNDI0IDExLjQ1MS0uMjg1IDE2LjM0Ny0xOS4zMDgtMi4wNzQtMS4xNjgtNS45NTctMi4zNjUtMTAuMzU1IDMuMzkxLTEyLjcxOCA0Ljg1NC03LjEgMTAuMjU5LTIuNTk5WiIgZmlsbD0iIzJlMmQyYyIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDExOC45NTIxLDI3NS45NzcxKSIgZD0iTTAgMCAzLjM2OSA4Ljk1MyAzLjkzNCA4Ljk0OSA2LjA1MSAxLjMwN1pNLTEuNDk2IDE1LjgxLTEwLjMwMy05LjE2MyA3LjcyOC00Ljg2OCA4LjU1NC05LjAxNSAxNC43Ni04LjU2MyA5LjM3NiAxNS43NloiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxMDkuOTA1NywyNjQuNzc4NCkiIGQ9Ik0wIDAtMjAuNzc2IDEyLjAwMS0yNi4yNTMtMTMuMTctMTkuMzgyLTE0LjcyLTE1LjgzMiAxLjE0OS0xMS4yNDctMS4wNS0xNC44MzgtNS4wMDMtMTIuMjc3LTcuNjQ5LTEyLjQ4MS03LjgyMS0xNC44MjctOS43Ny01LjY2Mi0xOS43NDItMy41MTQtMTIuNDUxLTcuNjYzLTcuODg4WiIgZmlsbD0iIzJlMmQyYyIvPjwvZz48L2c+PC9zdmc+'

export default function ProjectPlansMode({ profile }) {
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId]   = useState(null)
  const [columns, setColumns] = useState({}) // { [planId]: Column[] }
  const [cells, setCells]     = useState({}) // { [columnId]: Cell[] }
  const [eventTypes, setEventTypes] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving]   = useState(false)
  const cardRefs = useRef({}) // { `${colId}_${cellId}`: HTMLElement } — for per-row height equalize

  // import / sync
  const [importFor, setImportFor]       = useState(null) // planId whose import panel is open
  const [importEvents, setImportEvents] = useState([])   // candidate production_events (with _crew[])
  const [importSel, setImportSel]       = useState(new Set())
  const [importSearch, setImportSearch] = useState('')
  const [importBusy, setImportBusy]     = useState(false)
  const [syncBusy, setSyncBusy]         = useState(null) // planId currently syncing

  useEffect(() => { load() }, [])

  // יישור גובה כרטיסים לפי שורה: כרטיס i בכל הימים מקבל את גובה הכרטיס הגבוה בשורה i.
  // רץ אחרי שה-textarea-ים כבר קבעו את גובהם (אפקט הורה רץ אחרי אפקטי הילדים).
  useEffect(() => {
    if (!openId) return
    const cols = columns[openId] || []
    const rows = {}
    cols.forEach(col => {
      (cells[col.id] || []).forEach((cell, idx) => {
        const el = cardRefs.current[`${col.id}_${cell.id}`]
        if (!el) return
        if (!rows[idx]) rows[idx] = []
        rows[idx].push(el)
      })
    })
    const groups = Object.values(rows)
    groups.forEach(els => els.forEach(el => { el.style.minHeight = '' }))       // reset
    groups.forEach(els => {                                                     // measure + apply
      let max = 0
      els.forEach(el => { if (el.offsetHeight > max) max = el.offsetHeight })
      els.forEach(el => { el.style.minHeight = max + 'px' })
    })
  }, [openId, columns, cells])

  const typeLabel = v => { const t = eventTypes.find(t => t.value === v); return t ? t.label : (v || '') }

  async function load() {
    setLoading(true)
    const [{ data }, { data: ts }] = await Promise.all([
      supabase.from('project_plans').select('*').order('created_at', { ascending: false }),
      supabase.from('event_types').select('*').order('sort_order'),
    ])
    setPlans(data || [])
    setEventTypes(ts || [])
    setLoading(false)
  }

  // returns board data WITHOUT touching state
  async function fetchBoard(planId) {
    const [{ data: cols }, { data: allCells }] = await Promise.all([
      supabase.from('project_plan_columns').select('*').eq('plan_id', planId).order('sort_order'),
      supabase.from('project_plan_cells').select('*').eq('plan_id', planId).order('sort_order'),
    ])
    const grouped = {}
    ;(cols || []).forEach(c => { grouped[c.id] = [] })
    ;(allCells || []).forEach(cell => {
      if (!grouped[cell.column_id]) grouped[cell.column_id] = []
      grouped[cell.column_id].push(cell)
    })
    return { cols: cols || [], allCells: allCells || [], grouped }
  }

  async function loadBoard(planId) {
    const { cols, grouped } = await fetchBoard(planId)
    setColumns(prev => ({ ...prev, [planId]: cols }))
    setCells(prev => ({ ...prev, ...grouped }))
  }

  function toggleOpen(id) {
    if (openId === id) { setOpenId(null); setImportFor(null); return }
    setOpenId(id)
    setImportFor(null)
    if (!columns[id]) loadBoard(id)
  }

  // ---- plans ----
  async function createPlan() {
    if (!newTitle.trim()) return
    setSaving(true)
    const { data } = await supabase.from('project_plans')
      .insert({ title: newTitle.trim(), status: 'draft', created_by: profile?.id || null })
      .select().single()
    if (data) {
      setPlans(prev => [data, ...prev])
      setColumns(prev => ({ ...prev, [data.id]: [] }))
      setOpenId(data.id)
      setNewTitle('')
      setShowNew(false)
    }
    setSaving(false)
  }

  async function updatePlan(id, field, value) {
    setPlans(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    await supabase.from('project_plans').update({ [field]: value }).eq('id', id)
  }

  async function deletePlan(id) {
    await supabase.from('project_plans').delete().eq('id', id) // cascades columns + cells
    setPlans(prev => prev.filter(p => p.id !== id))
    if (openId === id) setOpenId(null)
  }

  async function duplicatePlan(plan) {
    const { cols, grouped } = await fetchBoard(plan.id)
    const { data: newPlan } = await supabase.from('project_plans')
      .insert({ title: plan.title + ' (עותק)', status: plan.status || 'draft', created_by: profile?.id || null })
      .select().single()
    if (!newPlan) return
    const newCols = []
    const newCellsByCol = {}
    for (let i = 0; i < cols.length; i++) {
      const src = cols[i]
      const { data: nc } = await supabase.from('project_plan_columns')
        .insert({ plan_id: newPlan.id, date: src.date, category: src.category || null, sort_order: i })
        .select().single()
      if (!nc) continue
      newCols.push(nc)
      const srcCells = grouped[src.id] || []
      if (srcCells.length) {
        const { data: ins } = await supabase.from('project_plan_cells')
          .insert(srcCells.map((cell, j) => ({
            plan_id: newPlan.id, column_id: nc.id,
            action: cell.action || '', crew: cell.crew || '', notes: cell.notes || '',
            source_event_id: cell.source_event_id || null, sort_order: j,
          })))
          .select()
        newCellsByCol[nc.id] = (ins || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      } else {
        newCellsByCol[nc.id] = []
      }
    }
    setPlans(prev => [newPlan, ...prev])
    setColumns(prev => ({ ...prev, [newPlan.id]: newCols }))
    setCells(prev => ({ ...prev, ...newCellsByCol }))
  }

  // ---- columns (days) ----
  async function persistColOrder(sorted) {
    await Promise.all(sorted.map((c, i) => supabase.from('project_plan_columns').update({ sort_order: i }).eq('id', c.id)))
  }

  async function addColumn(planId) {
    const curr = columns[planId] || []
    const { data } = await supabase.from('project_plan_columns')
      .insert({ plan_id: planId, date: todayISO(), sort_order: curr.length })
      .select().single()
    if (data) {
      const merged = sortColsByDate([...curr, data])
      setColumns(prev => ({ ...prev, [planId]: merged }))
      setCells(prev => ({ ...prev, [data.id]: [] }))
      await persistColOrder(merged)
    }
  }

  async function updateColumnDate(planId, colId, value) {
    setColumns(prev => ({ ...prev, [planId]: prev[planId].map(c => c.id === colId ? { ...c, date: value } : c) }))
    await supabase.from('project_plan_columns').update({ date: value || null }).eq('id', colId)
  }

  async function updateColumnCategory(planId, colId, value) {
    setColumns(prev => ({ ...prev, [planId]: prev[planId].map(c => c.id === colId ? { ...c, category: value } : c) }))
    await supabase.from('project_plan_columns').update({ category: value || null }).eq('id', colId)
  }

  async function deleteColumn(planId, colId) {
    await supabase.from('project_plan_columns').delete().eq('id', colId) // cascades cells
    setColumns(prev => ({ ...prev, [planId]: (prev[planId] || []).filter(c => c.id !== colId) }))
    setCells(prev => { const n = { ...prev }; delete n[colId]; return n })
  }

  async function moveColumn(planId, index, dir) {
    const curr = [...(columns[planId] || [])]
    const target = index + dir
    if (target < 0 || target >= curr.length) return
    ;[curr[index], curr[target]] = [curr[target], curr[index]]
    setColumns(prev => ({ ...prev, [planId]: curr }))
    await Promise.all(curr.map((c, i) => supabase.from('project_plan_columns').update({ sort_order: i }).eq('id', c.id)))
  }

  // ---- cells ----
  async function addCell(planId, colId) {
    const curr = cells[colId] || []
    const { data } = await supabase.from('project_plan_cells')
      .insert({ plan_id: planId, column_id: colId, action: '', crew: '', notes: '', sort_order: curr.length })
      .select().single()
    if (data) setCells(prev => ({ ...prev, [colId]: [...(prev[colId] || []), data] }))
  }

  function setCellField(colId, cellId, field, value) {
    setCells(prev => ({ ...prev, [colId]: prev[colId].map(c => c.id === cellId ? { ...c, [field]: value } : c) }))
  }

  async function commitCell(cellId, field, value) {
    await supabase.from('project_plan_cells').update({ [field]: value }).eq('id', cellId)
  }

  async function deleteCell(colId, cellId) {
    await supabase.from('project_plan_cells').delete().eq('id', cellId)
    setCells(prev => ({ ...prev, [colId]: (prev[colId] || []).filter(c => c.id !== cellId) }))
  }

  async function moveCell(colId, index, dir) {
    const curr = [...(cells[colId] || [])]
    const target = index + dir
    if (target < 0 || target >= curr.length) return
    ;[curr[index], curr[target]] = [curr[target], curr[index]]
    setCells(prev => ({ ...prev, [colId]: curr }))
    await Promise.all(curr.map((c, i) => supabase.from('project_plan_cells').update({ sort_order: i }).eq('id', c.id)))
  }

  // ---- import from technical production ----
  function cellSummary(ev) {
    return {
      action: ev.event_name || '',
      crew: (ev._crew || []).join(', '),
      notes: [ev.venue, typeLabel(ev.type)].filter(Boolean).join(' · '),
    }
  }

  async function openImportPicker(planId) {
    if (importFor === planId) { setImportFor(null); return }
    setImportFor(planId)
    setImportSel(new Set())
    setImportSearch('')
    setImportBusy(true)
    const { data: evs } = await supabase.from('production_events')
      .select('*').is('deleted_at', null).order('date', { ascending: true })
    const withDate = (evs || []).filter(e => e.date)
    const ids = withDate.map(e => e.id)
    const crewMap = {}
    if (ids.length) {
      const { data: ppl } = await supabase.from('production_people')
        .select('production_event_id,name,status').in('production_event_id', ids)
      ;(ppl || []).forEach(p => {
        if (p.status === 'yellow' && (p.name || '').trim()) {
          if (!crewMap[p.production_event_id]) crewMap[p.production_event_id] = []
          crewMap[p.production_event_id].push(p.name.trim())
        }
      })
    }
    setImportEvents(withDate.map(e => ({ ...e, _crew: crewMap[e.id] || [] })))
    setImportBusy(false)
  }

  function toggleImportSel(id) {
    setImportSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function runImport(planId) {
    const sel = importEvents.filter(e => importSel.has(e.id))
    if (!sel.length) return
    setImportBusy(true)
    const { cols, allCells } = await fetchBoard(planId)
    const colByDate = {}
    cols.forEach(c => { if (c.date) colByDate[c.date] = c })
    const linkedByEvent = {}
    allCells.forEach(c => { if (c.source_event_id) linkedByEvent[c.source_event_id] = c })
    const colCount = {}
    cols.forEach(c => { colCount[c.id] = allCells.filter(x => x.column_id === c.id).length })
    let nextColSort = cols.length

    for (const ev of sel) {
      let col = colByDate[ev.date]
      if (!col) {
        const { data: nc } = await supabase.from('project_plan_columns')
          .insert({ plan_id: planId, date: ev.date, sort_order: nextColSort++ }).select().single()
        if (!nc) continue
        col = nc; colByDate[ev.date] = nc; colCount[nc.id] = 0
      }
      const s = cellSummary(ev)
      const existing = linkedByEvent[ev.id]
      if (existing) {
        await supabase.from('project_plan_cells')
          .update({ action: s.action, crew: s.crew, notes: s.notes, column_id: col.id })
          .eq('id', existing.id)
      } else {
        await supabase.from('project_plan_cells').insert({
          plan_id: planId, column_id: col.id, source_event_id: ev.id,
          action: s.action, crew: s.crew, notes: s.notes, sort_order: colCount[col.id]++,
        })
      }
    }
    // מיון כרונולוגי של כל העמודות (כולל החדשות) לפי תאריך
    const sorted = sortColsByDate(Object.values(colByDate))
    await persistColOrder(sorted)
    await loadBoard(planId)
    setImportBusy(false)
    setImportFor(null)
    setImportSel(new Set())
  }

  // re-pull crew/notes/action for every linked card in the plan
  async function syncLinked(planId) {
    setSyncBusy(planId)
    const { allCells } = await fetchBoard(planId)
    const linked = allCells.filter(c => c.source_event_id)
    if (!linked.length) { setSyncBusy(null); return }
    const eventIds = [...new Set(linked.map(c => c.source_event_id))]
    const [{ data: evs }, { data: ppl }] = await Promise.all([
      supabase.from('production_events').select('*').in('id', eventIds),
      supabase.from('production_people').select('production_event_id,name,status').in('production_event_id', eventIds),
    ])
    const evMap = {}; (evs || []).forEach(e => { evMap[e.id] = e })
    const crewMap = {}
    ;(ppl || []).forEach(p => {
      if (p.status === 'yellow' && (p.name || '').trim()) {
        if (!crewMap[p.production_event_id]) crewMap[p.production_event_id] = []
        crewMap[p.production_event_id].push(p.name.trim())
      }
    })
    for (const cell of linked) {
      const ev = evMap[cell.source_event_id]
      if (!ev) continue // event hard-deleted → leave card as-is
      const s = cellSummary({ ...ev, _crew: crewMap[ev.id] || [] })
      await supabase.from('project_plan_cells')
        .update({ action: s.action, crew: s.crew, notes: s.notes }).eq('id', cell.id)
    }
    await loadBoard(planId)
    setSyncBusy(null)
  }

  // ---- PDF export (styled print window) ----
  function pdfEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  async function exportPdf(plan) {
    const { cols, grouped } = await fetchBoard(plan.id)
    const days = sortColsByDate(cols)
    const dates = days.map(d => d.date).filter(Boolean)
    const range = dates.length
      ? (fmtShort(dates[0]) + (dates.length > 1 ? ' – ' + fmtShort(dates[dates.length - 1]) : ''))
      : ''
    const stLabel = getPlanStatus(plan.status).label
    const notes = plan.notes || ''

    const daysHtml = days.map(col => {
      const cat = getDayCategory(col.category)
      const cells = grouped[col.id] || []
      const rows = cells.length
        ? cells.map((c, i) => `
          <tr class="${i % 2 ? 'alt' : ''}">
            <td class="c-action">${c.source_event_id ? '<span class="lnk"></span>' : ''}${pdfEsc(c.action) || '<span class="ph">—</span>'}</td>
            <td>${pdfEsc(c.crew)}</td>
            <td class="c-notes">${pdfEsc(c.notes).replace(/\n/g, '<br>')}</td>
          </tr>`).join('')
        : `<tr><td colspan="3" class="empty">אין פעולות</td></tr>`
      return `
        <section class="day">
          <div class="day-head" style="background:${cat.head};color:${cat.text}">
            <span class="dd">${pdfEsc(fmtDay(col.date))}</span>
            ${cat.value ? `<span class="cat" style="border-color:${cat.text}">${pdfEsc(cat.label)}</span>` : ''}
          </div>
          <table>
            <thead><tr><th class="c-action">פעולה</th><th>צוות</th><th class="c-notes">הערות</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`
    }).join('')

    const t = new Date()
    const stamp = t.getDate() + '/' + (t.getMonth() + 1) + '/' + t.getFullYear()

    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"/>
<title>${pdfEsc(plan.title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Heebo','Assistant',Arial,sans-serif; direction: rtl; color:#1f2937; margin:0; padding:26px 30px;
         -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  header.doc { display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:2px solid #E0197D; padding-bottom:12px; margin-bottom:16px; }
  .logo { height:58px; width:auto; flex-shrink:0; }
  .brand { font-size:11px; letter-spacing:.04em; color:#E0197D; font-weight:600; margin-bottom:2px; }
  h1 { font-size:24px; margin:0 0 4px; color:#111827; }
  .meta { font-size:12px; color:#6b7280; }
  .notes { background:#F9FAFB; border:1px solid #eee; border-radius:8px; padding:10px 12px; margin-bottom:18px; font-size:12px; color:#374151; }
  .notes-t { font-size:11px; color:#9ca3af; margin-bottom:3px; }
  section.day { border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; margin-bottom:13px; break-inside:avoid; }
  .day-head { display:flex; align-items:center; justify-content:space-between; padding:7px 12px; font-weight:700; font-size:13px; }
  .day-head .cat { font-size:10px; font-weight:600; border:1px solid; border-radius:999px; padding:1px 9px; background:rgba(255,255,255,.4); }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { background:#F3F4F6; color:#374151; text-align:right; font-weight:600; padding:6px 12px; border-bottom:1px solid #e5e7eb; }
  td { padding:7px 12px; border-bottom:1px solid #f1f1f1; text-align:right; vertical-align:top; }
  tr:last-child td { border-bottom:none; }
  tr.alt td { background:#FAFAFB; }
  .c-action { width:42%; font-weight:600; color:#111827; }
  .c-notes { width:30%; color:#6b7280; }
  .ph { color:#d1d5db; }
  .lnk { display:inline-block; width:6px; height:6px; border-radius:50%; background:#E0197D; margin-left:6px; vertical-align:middle; }
  td.empty { color:#9ca3af; text-align:center; padding:10px; }
  footer { margin-top:22px; padding-top:10px; border-top:1px solid #eee; font-size:10px; color:#9ca3af; text-align:center; }
  @page { margin:14mm 12mm; }
</style></head><body>
  <header class="doc">
    <div>
      <div class="brand">הזירה · תכנון פרויקטים</div>
      <h1>${pdfEsc(plan.title)}</h1>
      <div class="meta">${pdfEsc(stLabel)}${range ? ' · ' + range : ''}${days.length ? ' · ' + days.length + ' ימים' : ''}</div>
    </div>
    <img class="logo" src="${HAZIRA_LOGO}" alt="הזירה" />
  </header>
  ${notes ? `<div class="notes"><div class="notes-t">הערות כלליות</div><div>${pdfEsc(notes).replace(/\n/g, '<br>')}</div></div>` : ''}
  ${daysHtml || '<div class="empty" style="text-align:center;color:#9ca3af;padding:30px">אין ימים בתוכנית</div>'}
  <footer>הופק ב-${stamp} · הזירה</footer>
  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script>
</body></html>`

    const win = window.open('', '_blank')
    if (!win) { alert('חלון ההדפסה נחסם — אפשר חלונות קופצים (pop-ups) לאתר ונסה שוב'); return }
    win.document.write(html)
    win.document.close()
  }

  if (loading) return <div className="text-center text-gray-400 py-8">טוען...</div>

  return (
    <div className="max-w-full" dir="rtl">
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNew(v => !v)}
          className="bg-[#E0197D] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#A0106A] flex items-center gap-1">
          <i className="ti ti-plus" /> תוכנית חדשה
        </button>
      </div>

      {showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 max-w-md">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createPlan() }}
            placeholder="שם התוכנית *"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-3" />
          <div className="flex gap-2">
            <button onClick={createPlan} disabled={saving || !newTitle.trim()}
              className="flex-1 bg-[#E0197D] text-white text-sm py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
              {saving ? 'שומר...' : 'צור תוכנית'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500">ביטול</button>
          </div>
        </div>
      )}

      {plans.length === 0 && !showNew && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-[13px] text-gray-400">
          אין תוכניות — לחץ על "תוכנית חדשה" להתחלה
        </div>
      )}

      {plans.map(plan => {
        const isOpen = openId === plan.id
        const planCols = columns[plan.id] || []
        const st = getPlanStatus(plan.status)
        const linkedEventIds = new Set()
        planCols.forEach(c => (cells[c.id] || []).forEach(cell => { if (cell.source_event_id) linkedEventIds.add(cell.source_event_id) }))
        const hasLinked = linkedEventIds.size > 0
        return (
          <div key={plan.id} id={`pp-${plan.id}`} className="bg-white border-2 border-[#B6CFD0] rounded-xl mb-3 overflow-hidden shadow-sm">
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 flex-row-reverse"
              onClick={() => toggleOpen(plan.id)}>
              <div className="flex-1 text-right">
                <input
                  value={plan.title}
                  onChange={e => setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, title: e.target.value } : p))}
                  onBlur={e => updatePlan(plan.id, 'title', e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="text-[13px] font-semibold text-gray-800 bg-transparent outline-none text-right w-full"
                />
              </div>
              <div className="flex items-center gap-1">
                <select value={plan.status || 'draft'} onClick={e => e.stopPropagation()}
                  onChange={e => updatePlan(plan.id, 'status', e.target.value)}
                  className={`text-[11px] px-2 py-1 rounded-lg border-0 outline-none cursor-pointer ${st.color}`}>
                  {PLAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={e => { e.stopPropagation(); exportPdf(plan) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="ייצוא PDF">
                  <i className="ti ti-file-type-pdf" style={{ fontSize: 13 }} />
                </button>
                <button onClick={e => { e.stopPropagation(); duplicatePlan(plan) }}
                  className="text-gray-300 hover:text-[#E0197D] p-1" title="שכפל תוכנית">
                  <i className="ti ti-copy" style={{ fontSize: 13 }} />
                </button>
                <button onClick={e => { e.stopPropagation(); if (window.confirm('למחוק את התוכנית?')) deletePlan(plan.id) }}
                  className="text-gray-300 hover:text-red-500 p-1" title="מחק">
                  <i className="ti ti-trash" style={{ fontSize: 13 }} />
                </button>
                <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{ fontSize: 13 }} />
              </div>
            </div>

            {/* board */}
            {isOpen && (
              <div className="border-t border-gray-50 p-4">
                {/* project notes */}
                <div className="mb-3">
                  <label className="text-[11px] text-gray-400 mb-1 block text-right">הערות כלליות לפרויקט</label>
                  <textarea
                    value={plan.notes || ''}
                    onChange={e => setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, notes: e.target.value } : p))}
                    onBlur={e => updatePlan(plan.id, 'notes', e.target.value)}
                    placeholder="הערות, אנשי קשר, לינקים..."
                    rows={2}
                    className="w-full text-[13px] px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y"
                  />
                </div>
                {/* toolbar */}
                <div className="flex justify-end gap-2 mb-3">
                  {hasLinked && (
                    <button onClick={() => syncLinked(plan.id)} disabled={syncBusy === plan.id}
                      className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-[#E0197D] hover:text-[#E0197D] flex items-center gap-1.5 disabled:opacity-50">
                      <i className={`ti ${syncBusy === plan.id ? 'ti-loader-2 animate-spin' : 'ti-refresh'}`} style={{ fontSize: 14 }} />
                      {syncBusy === plan.id ? 'מסנכרן...' : 'סנכרן מקושרים'}
                    </button>
                  )}
                  <button onClick={() => openImportPicker(plan.id)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] flex items-center gap-1.5">
                    <i className="ti ti-download" style={{ fontSize: 14 }} /> ייבא מהפקה טכנית
                  </button>
                </div>

                {/* import picker */}
                {importFor === plan.id && (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                    {importBusy ? (
                      <div className="text-center text-[12px] text-gray-400 py-4 flex items-center justify-center gap-2">
                        <i className="ti ti-loader-2 animate-spin" /> טוען אירועים...
                      </div>
                    ) : importEvents.length === 0 ? (
                      <div className="text-center text-[12px] text-gray-400 py-4">אין אירועים עם תאריך בהפקה הטכנית</div>
                    ) : (
                      <>
                        <div className="relative mb-2">
                          <i className="ti ti-search absolute top-1/2 -translate-y-1/2 right-2.5 text-gray-300" style={{ fontSize: 14 }} />
                          <input value={importSearch} onChange={e => setImportSearch(e.target.value)}
                            placeholder="חיפוש אירוע..."
                            className="w-full text-[12px] pr-8 pl-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right" />
                        </div>
                        <div className="text-[11px] text-gray-400 mb-2 px-1 text-right">בחר אירועים — כל אירוע ייכנס ככרטיס ביום התואם. אירוע שכבר יובא יעודכן.</div>
                        {(() => {
                          const q = importSearch.trim().toLowerCase()
                          const shown = q
                            ? importEvents.filter(e => (e.event_name || '').toLowerCase().includes(q) || (e.venue || '').toLowerCase().includes(q))
                            : importEvents
                          if (shown.length === 0) return <div className="text-center text-[12px] text-gray-400 py-4">לא נמצאו אירועים תואמים</div>
                          return (
                            <div className="max-h-64 overflow-y-auto space-y-1">
                              {shown.map(ev => {
                                const already = linkedEventIds.has(ev.id)
                                const checked = importSel.has(ev.id)
                                return (
                                  <label key={ev.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-right ${checked ? 'bg-[#FCE4F3]' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={checked} onChange={() => toggleImportSel(ev.id)} className="accent-[#E0197D] shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[12px] font-medium text-gray-800 flex items-center gap-1.5 min-w-0">
                                        {already && <span className="text-[9px] text-[#E0197D] border border-[#E0197D] rounded px-1 py-px shrink-0">מקושר</span>}
                                        <span className="truncate">{ev.event_name}</span>
                                      </div>
                                      <div className="text-[11px] text-gray-400 flex gap-2 flex-wrap">
                                        {ev._crew.length > 0 && <span>{ev._crew.length} אישרו</span>}
                                        {ev.venue && <span>{ev.venue}</span>}
                                        <span>{fmtShort(ev.date)}</span>
                                      </div>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )
                        })()}
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => runImport(plan.id)} disabled={importSel.size === 0}
                            className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">
                            ייבא {importSel.size > 0 ? `(${importSel.size})` : ''}
                          </button>
                          <button onClick={() => setImportFor(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-[13px] text-gray-500">ביטול</button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* columns */}
                <div className="flex gap-3 overflow-x-auto pb-2 items-start">
                  {planCols.map((col, ci) => {
                    const colCells = cells[col.id] || []
                    const cat = getDayCategory(col.category)
                    return (
                      <div key={col.id} className="w-64 flex-shrink-0 bg-gray-50 rounded-xl border border-gray-300 overflow-hidden">
                        {/* column header */}
                        <div className="px-3 py-2 flex items-center gap-1" style={{ backgroundColor: cat.head }}>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-bold truncate" style={{ color: cat.text }}>{fmtDay(col.date)}</div>
                            <div className="flex gap-1 mt-1">
                              <input type="date" value={col.date || ''}
                                onChange={e => updateColumnDate(plan.id, col.id, e.target.value)}
                                className="flex-1 min-w-0 text-[11px] px-1.5 py-0.5 rounded bg-white/70 border border-black/10 outline-none focus:border-[#E0197D]" />
                              <select value={col.category || ''}
                                onChange={e => updateColumnCategory(plan.id, col.id, e.target.value)}
                                title="קטגוריית יום"
                                className="text-[10px] px-1 py-0.5 rounded bg-white/70 border border-black/10 outline-none focus:border-[#E0197D] cursor-pointer">
                                {DAY_CATEGORIES.map(c => <option key={c.value || 'none'} value={c.value}>{c.label}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <button onClick={() => moveColumn(plan.id, ci, -1)} disabled={ci === 0}
                              className="text-gray-500 hover:text-[#E0197D] disabled:opacity-30 leading-none" title="הזז ימינה">
                              <i className="ti ti-chevron-right" style={{ fontSize: 14 }} />
                            </button>
                            <button onClick={() => moveColumn(plan.id, ci, 1)} disabled={ci === planCols.length - 1}
                              className="text-gray-500 hover:text-[#E0197D] disabled:opacity-30 leading-none" title="הזז שמאלה">
                              <i className="ti ti-chevron-left" style={{ fontSize: 14 }} />
                            </button>
                          </div>
                          <button onClick={() => { if (window.confirm('למחוק את היום וכל הפעולות שבו?')) deleteColumn(plan.id, col.id) }}
                            className="text-gray-500 hover:text-red-500" title="מחק יום">
                            <i className="ti ti-trash" style={{ fontSize: 13 }} />
                          </button>
                        </div>

                        {/* cells */}
                        <div className="p-2 space-y-2">
                          {colCells.map((cell, cj) => (
                            <div key={cell.id}
                              ref={el => { const k = `${col.id}_${cell.id}`; if (el) cardRefs.current[k] = el; else delete cardRefs.current[k] }}
                              className="bg-white rounded-lg border border-[#E0197D]/30 p-2 group">
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-start gap-1 justify-end">
                                    {cell.source_event_id && <i className="ti ti-link text-[#E0197D] mt-0.5 shrink-0" style={{ fontSize: 11 }} title="מקושר לאירוע בהפקה הטכנית — יתעדכן בסנכרון" />}
                                    <AutoTextarea value={cell.action || ''} placeholder="פעולה"
                                      onChange={e => setCellField(col.id, cell.id, 'action', e.target.value)}
                                      onBlur={e => commitCell(cell.id, 'action', e.target.value)}
                                      className="flex-1 min-w-0 text-[12px] font-medium text-gray-800 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                  </div>
                                  <AutoTextarea value={cell.crew || ''} placeholder="צוות"
                                    onChange={e => setCellField(col.id, cell.id, 'crew', e.target.value)}
                                    onBlur={e => commitCell(cell.id, 'crew', e.target.value)}
                                    className="w-full text-[11px] text-gray-600 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                  <AutoTextarea value={cell.notes || ''} placeholder="הערות"
                                    onChange={e => setCellField(col.id, cell.id, 'notes', e.target.value)}
                                    onBlur={e => commitCell(cell.id, 'notes', e.target.value)}
                                    className="w-full text-[11px] text-gray-400 bg-transparent outline-none text-right placeholder:text-gray-300" />
                                </div>
                                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => moveCell(col.id, cj, -1)} disabled={cj === 0}
                                    className="text-gray-300 hover:text-[#E0197D] disabled:opacity-20 leading-none" title="למעלה">
                                    <i className="ti ti-chevron-up" style={{ fontSize: 13 }} />
                                  </button>
                                  <button onClick={() => moveCell(col.id, cj, 1)} disabled={cj === colCells.length - 1}
                                    className="text-gray-300 hover:text-[#E0197D] disabled:opacity-20 leading-none" title="למטה">
                                    <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
                                  </button>
                                  <button onClick={() => deleteCell(col.id, cell.id)}
                                    className="text-gray-300 hover:text-red-500 leading-none" title="מחק">
                                    <i className="ti ti-x" style={{ fontSize: 13 }} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addCell(plan.id, col.id)}
                            className="w-full text-[12px] text-gray-400 hover:text-[#E0197D] border border-dashed border-gray-200 hover:border-[#E0197D] rounded-lg py-1.5 flex items-center justify-center gap-1">
                            <i className="ti ti-plus" style={{ fontSize: 13 }} /> פעולה
                          </button>
                        </div>
                      </div>
                    )
                  })}

                  {/* add day */}
                  <button onClick={() => addColumn(plan.id)}
                    className="w-40 flex-shrink-0 h-24 text-[13px] text-gray-400 hover:text-[#E0197D] border-2 border-dashed border-gray-200 hover:border-[#E0197D] rounded-xl flex flex-col items-center justify-center gap-1">
                    <i className="ti ti-calendar-plus" style={{ fontSize: 20 }} /> הוסף יום
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
