'use client'
// HAZIRA-CULT-V26
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const DEV_ID = '1ad454b6-4087-49c8-86c6-3b6582dc1327'
const HE_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

const ASPECTS = [
  { key: 'times',  label: 'זמנים',      icon: 'ti-clock', hint: 'לו״ז זמנים (פורמט מלא בשלב הבא)' },
  { key: 'crew',   label: 'צוות',        icon: 'ti-users' },
  { key: 'gear',   label: 'ציוד',        icon: 'ti-plug', hint: 'רשימת ציוד + סטטוס (בשלב הבא)' },
  { key: 'notes',  label: 'הערות',       icon: 'ti-note', hint: 'פתקית / מפרט (בשלב הבא)' },
]

const CREW_ROWS = [
  { key: 'operation', label: 'צוות הפעלה' },
  { key: 'setup',     label: 'צוות הקמה' },
  { key: 'strike',    label: 'צוות פירוק' },
]
const OP_ROWS = [
  { key: 'night_mgmt', label: 'ניהול ערב' },
  { key: 'bar',        label: 'בר' },
  { key: 'cashier',    label: 'קופה' },
]
const CREW_MODES = {
  crew:   { key: 'crew',   rows: CREW_ROWS, label: 'צוות' },
  opcrew: { key: 'opcrew', rows: OP_ROWS,   label: 'צוות תפעול' },
}
const CULT_STATUSES = [
  { value: 'white',  label: 'לא נבדק', bg: '#F3F4F6', text: '#4B5563' },
  { value: 'green',  label: 'מוכן',    bg: '#DCFCE7', text: '#166534' },
  { value: 'teal',   label: 'ממתין',   bg: '#CCFBF1', text: '#0F766E' },
  { value: 'yellow', label: 'אישר',    bg: '#FEF9C3', text: '#854D0E' },
  { value: 'red',    label: 'לא יכול', bg: '#FEE2E2', text: '#991B1B' },
  { value: 'purple', label: 'לבירור',  bg: '#F3E8FF', text: '#6B21A8' },
]
const cultStatus = v => CULT_STATUSES.find(s => s.value === v) || CULT_STATUSES[0]
const newTagId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

const KIND = {
  production: { label: 'הפקה',  bg: '#FBEAF3', border: 'rgba(224,25,125,0.35)' },
  action:     { label: 'פעולה', bg: '#DBEAFE', border: 'rgba(37,99,235,0.45)' },
}
const kindOf = p => KIND[p?.kind] || KIND.production

const HAZIRA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIyNDQuMjI5IiBoZWlnaHQ9IjI4NS4xNCIgdmlld0JveD0iMCAwIDI0NC4yMjkgMjg1LjE0Ij48Zz48Zz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSw1MS41MDc4LDE1Ny4yNDE3MikiIGQ9Ik0wIDBDMCAwIDE5LjYwNyAxNC4yMTMgMjcuMDE2IDE3LjczNyAzMy41NzUgMjAuODU3IDYwLjIyNyAzMC42NTEgNzQuMDIxIDMwLjIxNiA4Ni42OTEgMjkuODE2IDEwNi41MjEgMjMuMTIxIDExNi4zNjkgMTguMDU3IDEyOS44ODMgMTEuMTA5IDEzNi41NjMgNS4zMTQgMTQyLjc4My0uNDM4IDE0NS40MDEtMi44NiAxNDUuNzk3LTQuMjUzIDE0NS40MjkgLjU0NSAxNDQuOTggNi40MDMgMTQ1LjYzNiAxNy4zODggMTQ1LjQ3IDIzLjExNyAxNDUuNDAxIDI1LjUyMSAxNDQuNTc0IDMyLjI2NCAxNDQuMTMyIDMzLjc3IDE0Mi4wODUgNDAuNzU5IDEzNi45MzIgNTQuOTQyIDEzNi45MzIgNTQuOTQyIDEzNC45NzMgNjAuODY3IDEzNS4zODggNTAuNzkxIDEzNC42MzUgNDYuNzkxIDEzNC4yMjIgNDQuNiAxMzMuNTk4IDM5LjU2NyAxMzMuMzI4IDM3LjcyMiAxMzMuMDU3IDM1Ljg3NyAxMzEuOTMxIDMxLjQzOSAxMzEuMTU4IDI4LjE1MSAxMzAuMjA0IDI0LjA4OSAxMjkuNiAyNi45NzEgMTI5LjQ2MiAyOC41MzRMMTI3Ljk0NSA0NS44NDZDMTI3LjgwNyA0Ny40MDkgMTI3LjU3MSA0OS45NjcgMTI3LjQxOSA1MS41MjlMMTI1LjczMyA2OC45MTdDMTI1LjU4MiA3MC40NzkgMTI1LjE1IDczLjAwNCAxMjQuNzc0IDc0LjUyOEwxMTcuOTI4IDkzLjM2NUMxMTYuODQgOTcuMTMyIDExNi43ODEgOTQuMzg4IDExNi41MTEgOTMuMzc5IDExNi41MTEgOTMuMzc5IDExNi44MjMgODUuMTYzIDExNi4xMDIgODEuNjU2IDExNC43NjggNzUuMTcgMTEyLjQ4MiA2NC4xMzQgMTExLjcyMiA1OS43OTYgMTExLjM5MSA1Ny44OTkgMTEwLjcwOCA1NC44NSAxMDkuMjMgNTIuMDk1IDEwNy45MzkgNDkuNjg4IDEwNC42NDYgNDMuOTg3IDEwNC42NDYgNDMuOTg3IDEwMi44NTggNDAuOTAzIDEwMi45MTYgNDIuODE1IDEwMi42MjIgNDQuMzU2TDEwMS44NjIgNDguMzQzQzEwMS41NjkgNDkuODg1IDEwMS4zNyA1Mi40MzEgMTAxLjQyMiA1NEwxMDIuMDI1IDcyLjI5MUMxMDIuMDc3IDczLjg1OSAxMDEuOTUyIDc2LjQxNyAxMDEuNzQ3IDc3Ljk3M0w5Ny4yMzkgMTEyLjI2MUM5Ny4wMzYgMTEzLjgxOCA5Ni41MzMgMTE2LjMzMSA5Ni4xMjUgMTE3Ljg0Nkw4Ni4wNjggMTU0Ljk1N0M4NC43OTIgMTU5LjM4IDg0LjA2MyAxNTYuMjk0IDgzLjk5NyAxNTQuNzI3TDg0LjkyOCAxMTQuODdDODQuODYzIDExMy4zMDEgODQuNzg1IDExMC43MzQgODQuNzU3IDEwOS4xNjUgODQuNzU3IDEwOS4xNjUgODMuNDEzIDg0LjA0IDgzLjAwOSA3NS42ODUgODIuODQ0IDcyLjI3MSA4Mi42MTQgNzAuNzgyIDgyLjM2OCA2OS45MDRMNzcuNjg2IDUzLjk2N0M3Ny4xOTIgNTIuNDc2IDc2LjQ5NCA1Mi41MDYgNzYuMTMxIDU0LjAzM0w3NC44MDkgNTkuNjE0Qzc0LjQ0NiA2MS4xNDIgNzQuMTA2IDYzLjY3NSA3NC4wNTQgNjUuMjQ1TDczLjQ0NCA4My4yNEM3My4zOTIgODQuODA5IDczLjA3MSA4Ny4zNDcgNzIuNzMyIDg4Ljg3OUw2OS41OTggMTAzLjA4NkM2OS4yNTkgMTA0LjYxOSA2OC44ODEgMTA3LjE1NCA2OC43NTcgMTA4LjcxOSA2OC43NTcgMTA4LjcxOSA2Ni4yMTggMTM2LjAyMSA2Ni4wMiAxNDQuNzM0IDY1Ljk5MiAxNDUuOTIxIDY2LjM0NCAxNDkuMjY0IDY0LjcxNiAxNDUuMTMgNjQuNzE2IDE0NS4xMyA1NS43MzkgMTE5LjA0OSA1NC44ODcgMTE0LjM3IDU0LjAzNSAxMDkuNjkxIDUxLjgxMSA5MC4yOSA1MS44MTEgOTAuMjkgNTEuNzk2IDg4LjcyIDUxLjY0MiA4Ni4xNiA1MS40NyA4NC41OTlMNTAuMjcxIDczLjc1MkM1MC4wOTkgNzIuMTkyIDQ5Ljk3IDY5LjYzMSA0OS45ODYgNjguMDYyTDQ5Ljk4NCA0Ny4xOThDNTAuMDE4IDQ0LjIzNSA0OS44MDggNDQuNzA4IDQ4LjA1IDQ1Ljg1OSA0Ni45MDggNDYuNjA3IDQ1Ljc1NiA0OC42MTUgNDUuMzUzIDUwLjEzM0w0Mi4yMDQgNjEuNDA4QzQxLjggNjIuOTI1IDQxLjIzNiA2NS40MjggNDAuOTQ5IDY2Ljk3MkwzNy4yNjcgODYuNzU5QzM2Ljk3OSA4OC4zMDMgMzYuNjQ2IDkwLjg0NiAzNi41MjUgOTIuNDFMMzUuOTU1IDEwMy4yMjFDMzUuODM0IDEwNC43ODcgMzUuMzQ3IDEwNC44NDMgMzQuODczIDEwMy4zNDYgMzQuODczIDEwMy4zNDYgMjcuMTc3IDgxLjI5MiAyNS45MTcgNzUuMjA0IDI0LjY1OCA2OS4xMTYgMjMuNTA4IDU0LjQzMSAyMy41MDggNTQuNDMxIDIzLjQ3OCA1Mi44NiAyMy4yOTMgNTAuMzAyIDIzLjEgNDguNzQ2TDIxLjc3NiAzOC4xMzZDMjEuNTgyIDM2LjU3OCAyMS4wNjQgMzQuMDcxIDIwLjYyNiAzMi41NjNMMTguNTMyIDI3LjMzM0MxOC4wOTUgMjUuODI3IDE3LjExOCAyNS43MTkgMTYuMzYzIDI3LjA5NSAxNi4zNjMgMjcuMDk1IDE1LjA4NyAyNy43NjEgMTIuNzI2IDMzLjczMSAxMC4zNjUgMzkuNzAxIDExLjcxMyA1My40OTcgMTEuNzEzIDUzLjQ5NyAxMS43NjggNTUuOTUzIDExLjE0NCA1NS40MzcgMTAuMzM3IDUzLjQ3OSA5LjUzIDUxLjUyMSAyLjI1IDMzLjA5NSAuNTU3IDI2Ljg3NS0xLjEzNiAyMC42NTQtMi4xNDkgNC44My0yLjQyMyAxLjIyOC0yLjYzMy0xLjUyNi0zLjI4Mi0yLjYxNSAwIDAiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNDkuMDA5MiwyMTcuNjQ5NSkiIGQ9Ik0wIDBDLjQ5IDEuNDkxIDEuMzE2IDMuOTIzIDEuODQgNS40MDNMMS45OTQgNS44MzlDMi44MzggOC4zNDEgMy4xMzMgOC4wNzEgNC40OTIgNi4xMzNMNS4wMTMgNS4zMjdDNS44NjMgNC4wMDcgNy4zNzcgMS45MzcgOC4zNzUgLjcyNUwxMS44NjEtMy41MDdDMTMuNTc2LTUuODY3IDEzLjM0NC02LjI1NCAxNC43NjktMy4wNzRMMTkuNjUgOC42OTNDMjAuMjUyIDEwLjE0NCAyMS4wMTcgMTIuMjc0IDIxLjM1MSAxMy40MjkgMjEuNjg0IDE0LjU4MyAyMS45MyAxNS40MDkgMjQuMzgxIDE0LjAyMUwyNC41NDkgMTMuOTE3QzI1Ljg4MSAxMy4wODggMjcuNDM2IDExLjIxMiAyOC4wMDEgOS43NDlMMjkuMzA5IDYuMzcxQzI5Ljg3NSA0LjkwNiAyOS43ODEgMi42ODcgMzEuNzg5IDYuMTY3IDMxLjc4OSA2LjE2NyAzNC45NTMgMTEuNDI1IDM1LjU3NyAxMy4zNTkgMzYuMTU3IDE1LjE1NiAzNi4zNTcgMTcuMDE5IDM2LjU2NyAxOC41NzkgMzYuNTY3IDE4LjU3OSAzNi43MjggMjIuNDk2IDM2Ljc2MyAyMy44MSAzNi44MDUgMjUuMzggMzcuMzQ1IDI3Ljg4NSAzNy44MjQgMjkuMzc5TDM5LjAwOCAzMy4wNjFDMzkuOTEyIDM1LjI0NSA0MC4yNDcgMzUuNTUzIDM3LjY5MyAzMy45NDUgMzcuNjkzIDMzLjk0NSAyMy41MjIgMjMuMTI1IDE1Ljc5MSAyMC4xMTcgNC4yMjkgMTUuNjE2LTEzLjM2OSAxMS4wOC0yMy40OCA5Ljg2LTMwLjA5IDkuMDYyLTY2LjMwNSAxOS42NzQtNzEuMzAxIDIxLjU4Mi03Ni4zMzcgMjMuNTA1LTkxLjAxMiAzNC42NzktOTEuMDEyIDM0LjY3OS05My40ODcgMzYuNjgzLTkzLjExMSAzNi4yNjUtOTIuMTg4IDMzLjg0NUwtOTAuNDU2IDI5LjI3NkMtODkuOSAyNy44MDgtODkuNTE5IDI1LjMyNS04OS42MTEgMjMuNzU4TC04OS44MTUgMjAuMjg4Qy04OS45MDYgMTguNzIxLTg5LjY1IDE2LjE5OC04OS4yNDUgMTQuNjgxTC04Ny44NDggOS40NUMtODcuNDQyIDcuOTM1LTg3LjA3OSA2LjUzMi04NS45NDMgOS4yOTdMLTgzLjgwNiAxNC4wNjNDLTgzLjE2NCAxNS40OTUtODIuMDY3IDE3LjUwOC04MS4zNyAxOC41MzUtODAuNjc0IDE5LjU2Mi03OS44MiAxOS4xNDgtNzkuNDc1IDE3LjYxOEwtNzguMzUzIDEyLjYzNEMtNzguMDA4IDExLjEwMy03Ny4xOTIgOC42ODItNzYuNTQgNy4yNTRMLTcxLjc2LTMuMjIxQy03MC43NTgtNS4yMzEtNzAuNDc0LTUuNTM4LTY5Ljc5LTMuMDc0TC02OC4zODcgMS44MjdDLTY3Ljk1NSAzLjMzNi02Ni44MjEgNS41OTEtNjUuODY3IDYuODM3TC02NC4xMzQgOS4xQy02MS44MjYgMTIuNTQxLTYxLjcwOCAxMS4wMTMtNTkuNTg5IDguNTA4TC01Ny45MjEgNi4wMDRDLTU3LjA1MSA0LjY5Ny01NS45IDIuNDIxLTU1LjM2MyAuOTQ2TC01MS4zOTMtOS45NzVDLTUwLjcwNC0xMi4yNDYtNTEuMTc3LTE0LjIwNy00OC45NTYtMTAuMTQ0TC00NS41OC01LjIzN0MtNDQuNzIyLTMuOTIyLTQzLjQ0NC0xLjY5OS00Mi43MzktLjI5NkwtNDEuNjM3IDEuODk3Qy00MC45MzIgMy4yOTktMzguODUyIDQuMTM4LTM3LjU3MSAxLjkxNkwtMzYuNjk3IC4yMzhDLTM1Ljk3Mi0xLjE1NS0zNC4wNS00Ljc5LTMzLjM5Ny02LjU0My0zMi44NS04LjAxMy0zMS45NjktMTAuMjcyLTMxLjMwNC0xMS42OTRMLTI3LjYxMy0xOS4wMDNDLTI2LjU4OS0yMC42NDYtMjYuOTkxLTIzLjEwMy0yNS4zNDYtMTguOTM4TC0yMS40MjQtMTEuNDg2Qy0yMC44NDItMTAuMDI5LTE5LjgyMi01LjkwMS0xOS44MjItNS45MDEtMTguNjk2LTIuMzU5LTE4LjAzIDEuMzg4LTE3LjM5NCAxLjQxNy0xNi44NCAxLjQ0NC0xNC43NzUtMi4wMjItMTQuMDU0LTMuNjg4TC0xMy4zMzMtNS4xMThDLTEyLjgxMy02LjYtMTEuNjkyLTguODkyLTEwLjg0NC0xMC4yMTFMLTguNzE4LTEzLjUxMUMtNy4wMDEtMTYuMTY5LTcuMjA3LTE2LjY3LTUuOTM0LTEzLjM0TC0yLjMwNy01LjgyMUMtMS42MjQtNC40MDctLjY2NS0yLjAyOS0uMTc3LS41MzlaIiBmaWxsPSIjRTAxOTdEIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMTAwLjA2NDksMTY3Ljg4OTcxKSIgZD0iTTAgMEMuMTQzIDguMzAxIDQuMTQyIDEyLjExMyA1LjYwNCAxMy43NSA5LjgwNCAxOC40NDYgMTUuNDIgMjEuNTE2IDIyLjAyNyAyMS41MTYgMjQuODU5IDIxLjUxNiAyNy40NzEgMjAuNzEgMzAuMDEzIDE5LjkxMyAzMy42MDQgMTguNzg2IDM0LjEwMiAxOC4zOTggMzQuNjI3IDE3LjgyNCAzNS4xMTMgMTcuMjkyIDM1LjU5OCAxNi40OTEgMzYuMjUxIDE1LjgxMyAzNi44MSAxNS4yMzEgMzcuMzYzIDE0LjY1IDM3LjkxMSAxNC4wNTkgMzguMDc0IDEzLjg4MyAzOC4yNTEgMTMuNzM1IDM4LjQwNiAxMy41OTUgNDEuMTczIDExLjExOSA0NC4yMjkgOC40IDQ0LjM4MiAwIDQ0LjUyLTcuNjM1IDM4LjM0My0xMy41MjQgMzguMzQzLTEzLjUyNCAzNy4yMDctMTQuNjA4IDM1Ljc2OS0xNi4xMSAzMy44OC0xNi44MDEgMzMuMTM3LTE3LjA3MyAzMS42MDQtMTcuNDg3IDMwLjg2OC0xNy43OCAyOC4xMDktMTguODc4IDI1LjM1OC0xOS44MjEgMjIuMTg5LTE5LjgyMSAyMi4wODctMTkuODIxIDIxLjc1NC0xOS44NTggMjEuMzk3LTE5Ljg1OCAyMS4wOTUtMTkuODU4IDE5LjQ1NC0xOS43OTEgMTguNTk3LTE5LjU4NyAxOC41OTctMTkuNTg3IDE3Ljk1NC0xOS40MzUgMTYuOTc2LTE5LjE0MiAxNS42NTQtMTguODA4IDE0LjM4Ni0xOC4zNSAxMy4xNzktMTcuNzc2IDExLjczNy0xNy4xNjEgMTAuMjYzLTE2LjM5OSA5LjExLTE1LjQ5MyAzLjkyNC0xMS40MTYtLjE2LTkuMjkyIDAgME0tNDkuMjUyLTEuNTgyQy00OS4yNTItMS41ODItMjYuMzk2LTE4LjMtMTcuMTM3LTIxLjg0NC03LjYzNS0yNS40ODEgMTYuMDIzLTMxLjM3IDI1LjQ1OS0zMS4zNTYgMzUuMDI1LTMxLjM0MSA1My43NTMtMjUuNjYyIDYyLjUyNS0yMS44NDQgNzEuMTE3LTE4LjEwNCA5NC42NDEtMS41ODIgOTQuNjQxLTEuNTgyIDk3LjQ1IC4xNTQgOTcuNTctLjU2NSA5NS4wMTQgMS4yMTRMOTMuNTY1IDIuMTY3QzkzLjU2NSAyLjE2NyA3NC41NjggMTUuOTI1IDY3LjY2NCAxOS41NTMgNTQuMTQyIDI2LjY1OSAyOC44ODEgMzEuOTYxIDIxLjc4OSAzMS45NTcgMTIuMjY0IDMxLjk1MS03Ljk3NCAyNC44NjItMTYuNzU5IDIxLjA3NS0yNS40NzcgMTcuMzE3LTQ5LjI1MiAxLjU4Mi00OS4yNTIgMS41ODItNTMuNTQzLS45NTktNTIuNzMgLjM4OS00OS4yNTItMS41ODIiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxMjIuMjQ3LDE3Ny43ODE4MikiIGQ9Ik0wIDBDNS44MTQgMCAxMC41NDIgNC43MyAxMC41NDIgMTAuNTQzIDEwLjU0MiAxNi4zNTYgNS44MTQgMjEuMDg1IDAgMjEuMDg1LTUuODEzIDIxLjA4NS0xMC41NDQgMTYuMzU2LTEwLjU0NCAxMC41NDMtMTAuNTQ0IDQuNzMtNS44MTMgMCAwIDAiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSw4MS44Mzc0LDI1MC4wMjA2MikiIGQ9Ik0wIDAtNS4zMS0yLjk2Mi0yLjM0Ny04LjI3MiAyLjk2Mi01LjMxWiIgZmlsbD0iI0UwMTk3RCIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDcxLjcxODIsMjc1LjAyMikiIGQ9Ik0wIDAgNy4xMjUtMS43OTQgMTEuMTA0IDE0Ljk3IDMuOTc5IDE2Ljc2NVoiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxODguMDk3MSwyNTEuMDIzMDEpIiBkPSJNMCAwIDUuMjYtMS45MTkgNS4zNzgtNy4xNTcgMTIuNDY0LTcuNDcxVi03LjQ1OEwxMi4yNzEgMi45NTggMi4xNTkgNi44NTVaIiBmaWxsPSIjRTAxOTdEIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMTQ1Ljc4MTcsMjY5LjUxMjc0KSIgZD0iTTAgMCAyLjEyMy0xMS45MjkgMi4xMzYtMTEuOTI3IDkuNjE1LTEwLjYxMSA3LjQ5MSAxLjMxN1oiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNDMuNDEzNSwyNTguNDI4OCkiIGQ9Ik0wIDAgMS4zNDgtNy4yOTQgMTQuOTIxLTQuOTA4IDE3LjgzMy0yMC42NjcgMTcuODQ3LTIwLjY2NSAyNS4zMjUtMTkuMzQ5IDIxLjA2NCAzLjcwMloiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNjguMTM0MiwyNTMuNjc2ODIpIiBkPSJNMCAwIDEuMzcyLTcuMjMyIDExLjQzLTQuMzQgMTUuODI2LTE5LjczOCAxNS44MzktMTkuNzM0IDIyLjk1My0xNy43MDMgMTYuNTIxIDQuODIyWiIgZmlsbD0iI0UwMTk3RCIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDIxMy4zMzkzLDI0NS40NTcxMykiIGQ9Ik0wIDAtLjAwNSAuMDA4LTMuMjAzIDIuNzAzIDEuMTU0IDYuNDUxLTMuMTg3IDEyLjcwOC05LjQ3MiA2LjQ5OC0xNS41MjYgNC44MjgtMTAuNTMxLTEuMTQ0LTcuMjgyLS4zMDItMy4xMjMtMTUuNDM4IDMuNjIyLTExLjM4IDMuNjIxLTExLjM3MVoiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwyNi43MjYsMjI4LjIwMTIyKSIgZD0iTTAgMC01LjU4Mi02LjY0OS0xMC43NTEtMi4zMS01LjE2MSA0LjMyNS0xMC44MDQgOS4zODMtMjYuNzI2LTkuNTE0LTIxLjA4My0xNC41NzMtMTUuNDg1LTcuOTI4LTEwLjMwNi0xMi4yNzYtMTUuODg5LTE4LjkyNS05Ljk0OS0yMy42MjYgNS45MzktNC43MDJaIiBmaWxsPSIjRTAxOTdEIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsNzIuOTU3NSwyNTAuNzUzMDIpIiBkPSJNMCAwLTkuMDE0IDItMTguNzQyIDcuNDUzLTIwLjkxNiAuNDE5LTEzLjYwOS0zLjc0NC0yNy43NjItMTUuODMzLTE3LjUxOC0xNy4yNS01LjI5NS0yMy4wNzgtMy42MTEtMTUuNzIyLTEyLjAyOC0xMS42MTVaIiBmaWxsPSIjRTAxOTdEIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMjE5LjkwMTgsMjQwLjAzNzYyKSIgZD0iTTAgMCA2LjgzNS0xMC4wMDUgNi44NDctOS45OTggMTMuMTI1LTUuNzI3IDYuMjkgNC4yNzhaIiBmaWxsPSIjRTAxOTdEIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMjMwLjg3ODQsMjE4Ljg3OTAyKSIgZD0iTTAgMC0xNy42ODctMTIuMDI1LTEzLjQ2Mi0xOC4xMjItMi4wNjUtMTAuMzczIDcuMDYxLTIzLjU0NiA3LjA3MS0yMy41MzkgMTMuMzUxLTE5LjI2OFoiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwzOS4xMzYyLDI1Mi42ODIyMikiIGQ9Ik0wIDAtNiAxLjUzIDEuMDExIDguMDQgMS41MTUgNy43ODRaTTYuMTU2LTEuNzEyIDkuNDI0IDExLjQ1MS0uMjg1IDE2LjM0Ny0xOS4zMDgtMi4wNzQtMS4xNjgtNS45NTctMi4zNjUtMTAuMzU1IDMuMzkxLTEyLjcxOCA0Ljg1NC03LjEgMTAuMjU5LTIuNTk5WiIgZmlsbD0iI0UwMTk3RCIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDExOC45NTIxLDI3NS45NzcxKSIgZD0iTTAgMCAzLjM2OSA4Ljk1MyAzLjkzNCA4Ljk0OSA2LjA1MSAxLjMwN1pNLTEuNDk2IDE1LjgxLTEwLjMwMy05LjE2MyA3LjcyOC00Ljg2OCA4LjU1NC05LjAxNSAxNC43Ni04LjU2MyA5LjM3NiAxNS43NloiIGZpbGw9IiNFMDE5N0QiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxMDkuOTA1NywyNjQuNzc4NCkiIGQ9Ik0wIDAtMjAuNzc2IDEyLjAwMS0yNi4yNTMtMTMuMTctMTkuMzgyLTE0LjcyLTE1LjgzMiAxLjE0OS0xMS4yNDctMS4wNS0xNC44MzgtNS4wMDMtMTIuMjc3LTcuNjQ5LTEyLjQ4MS03LjgyMS0xNC44MjctOS43Ny01LjY2Mi0xOS43NDItMy41MTQtMTIuNDUxLTcuNjYzLTcuODg4WiIgZmlsbD0iI0UwMTk3RCIvPjwvZz48L2c+PC9zdmc+'
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function printExport(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=980,height=1000')
  if (!win) { alert('חלון הייצוא נחסם — אפשר חלונות קופצים לאתר'); return }
  win.document.write(`<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  *{font-family:Arial,"Helvetica Neue",sans-serif;box-sizing:border-box}
  body{margin:26px;color:#222}
  .hdr{display:flex;align-items:center;gap:12px;border-bottom:3px solid #E0197D;padding-bottom:10px;margin-bottom:18px}
  .brand{font-size:28px;font-weight:800;color:#E0197D;letter-spacing:1px;display:flex;align-items:center;gap:8px}
  .brand img{height:52px}
  .title{font-size:16px;font-weight:700;margin-right:auto;color:#333}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  th,td{border:1px solid #E0197D44;padding:7px 9px;text-align:right;font-size:12px;vertical-align:top}
  th{background:#FCE4F3;color:#A0106A}
  h2{font-size:14px;color:#E0197D;margin:16px 0 6px;border-bottom:1px solid #F5D3E7;padding-bottom:3px}
  .muted{color:#888;font-size:11px}
  @media print{body{margin:12px}}
</style></head><body>
<div class="hdr"><div class="brand"><img src="${HAZIRA_LOGO}"/>הזירה</div><div class="title">${esc(title)}</div></div>
${bodyHtml}
<script>setTimeout(function(){window.print()},450)</script>
</body></html>`)
  win.document.close(); win.focus()
}

function StatusPicker({ status, onPick }) {
  const [open, setOpen] = useState(false)
  const st = cultStatus(status)
  return (
    <div className="relative flex-shrink-0">
      <button onClick={() => setOpen(o => !o)} style={{ backgroundColor: st.bg, color: st.text }}
        className="text-[11px] rounded-lg px-2 py-1 flex items-center gap-1 font-medium">
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 11 }} />
        {st.label}
      </button>
      {open && (
        <div className="absolute z-10 top-full mt-1 left-0 bg-white border border-[#EFC0D9] rounded-lg shadow-lg overflow-hidden min-w-[96px]">
          {CULT_STATUSES.map(s => (
            <button key={s.value} onClick={() => { onPick(s.value); setOpen(false) }}
              style={{ backgroundColor: s.bg, color: s.text }}
              className="w-full text-right px-3 py-1.5 text-[11px] font-medium hover:brightness-95">{s.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function fmtCell(ds) { if (!ds) return ''; const [y, m, d] = ds.split('-'); return `${d}/${m}/${y}` }
function dayName(ds) { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d); return 'יום ' + HE_DAYS[dt.getDay()] }
function isoAdd(ds, n) { const [y, m, d] = ds.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + n); return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0') }
function dateRange(from, to) {
  if (!from || !to) return []
  const out = []; let cur = from; let guard = 0
  while (cur <= to && guard < 400) { out.push(cur); cur = isoAdd(cur, 1); guard++ }
  return out
}

export default function CultPage() {
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [config, setConfig] = useState(null)
  const [prods, setProds] = useState([])
  const [newVenue, setNewVenue] = useState('')
  const [kindFilter, setKindFilter] = useState('all')
  const [showVenues, setShowVenues] = useState(false)
  const [addCell, setAddCell] = useState(null)   // { date }
  const [addName, setAddName] = useState('')
  const [addArtist, setAddArtist] = useState('')
  const [addVenue, setAddVenue] = useState('')
  const [addTime, setAddTime] = useState('')
  const [addKind, setAddKind] = useState('production')
  const [menuFor, setMenuFor] = useState(null)   // production id whose aspect-menu is open
  const [aspectEdit, setAspectEdit] = useState(null) // { prod, key }
  const [aspectDraft, setAspectDraft] = useState('')
  const [crewCtx, setCrewCtx] = useState(null)       // { kind:'prod', prod } | { kind:'day', ds }
  const [crew, setCrew] = useState({})
  const [crewAdd, setCrewAdd] = useState({ operation: '', setup: '', strike: '' })
  const [crewEditing, setCrewEditing] = useState(null) // { row, id }
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [subcats, setSubcats] = useState([])
  const [allItems, setAllItems] = useState([])
  const [gearFor, setGearFor] = useState(null)          // production whose gear window is open
  const [gear, setGear] = useState([])                  // [{ equipment_item_id, quantity }]
  const [gearOpenCat, setGearOpenCat] = useState(null)
  const [gearOpenSub, setGearOpenSub] = useState(null)
  const [manualName, setManualName] = useState('')
  const [manualQty, setManualQty] = useState('')
  const [timesFor, setTimesFor] = useState(null)   // production whose times (rundown) window is open
  const [times, setTimes] = useState([])           // [{ id, time, what, who, notes }]
  const [editProd, setEditProd] = useState(null)
  const [editName, setEditName] = useState('')
  const [editArtist, setEditArtist] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editKind, setEditKind] = useState('production')
  const [conflictDay, setConflictDay] = useState(null)
  const [crewDayFor, setCrewDayFor] = useState(null)
  const [dayNoteFor, setDayNoteFor] = useState(null)
  const [dayNoteDraft, setDayNoteDraft] = useState('')
  const dragId = useRef(null)
  const [dragOverId, setDragOverId] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const res = await supabase.auth.getUser().catch(() => null)
      const user = res?.data?.user
      if (!user || user.id !== DEV_ID) { setAllowed(false); setChecking(false); return }
      setAllowed(true)
      let cfg = null
      try {
        const r = await supabase.from('cult_config').select('*').eq('id', 1).maybeSingle()
        cfg = r.data
        if (!cfg) { const up = await supabase.from('cult_config').upsert({ id: 1 }).select().single(); cfg = up.data }
      } catch (e) {}
      setConfig(cfg || { id: 1, title: 'פולחן הסתיו 2026', venues: [], day_notes: {}, date_from: null, date_to: null })
      try {
        const { data: p } = await supabase.from('cult_productions').select('*').order('sort_order')
        setProds(p || [])
      } catch (e) { setProds([]) }
      try {
        const [{ data: cats }, { data: subs }, { data: items }] = await Promise.all([
          supabase.from('equipment_categories').select('*').order('sort_order'),
          supabase.from('equipment_subcategories').select('*').order('sort_order'),
          supabase.from('equipment_items').select('*').order('name'),
        ])
        setCategories(cats || []); setSubcats(subs || []); setAllItems(items || [])
      } catch (e) {}
    } catch (e) {
      setAllowed(false)
    } finally {
      setChecking(false)
    }
  }

  async function saveConfig(patch) {
    const next = { ...config, ...patch }
    setConfig(next)
    await supabase.from('cult_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
  }
  function addConfigVenue() {
    const v = newVenue.trim(); if (!v) return
    if ((config.venues || []).includes(v)) { setNewVenue(''); return }
    saveConfig({ venues: [...(config.venues || []), v] }); setNewVenue('')
  }
  function removeVenue(v) {
    if (!window.confirm(`להסיר את "${v}" מהלוח?`)) return
    saveConfig({ venues: (config.venues || []).filter(x => x !== v) })
  }

  async function createProduction() {
    if (!addName.trim() || !addCell) return
    const { data } = await supabase.from('cult_productions')
      .insert({ name: addName.trim(), artist: addArtist.trim(), venue: addVenue || null, time: addTime || null, kind: addKind, date: addCell.date, sort_order: prods.length, aspects: {} })
      .select().single()
    if (data) setProds(prev => [...prev, data])
    setAddCell(null); setAddName(''); setAddArtist(''); setAddVenue(''); setAddTime('')
  }
  async function updateProduction(id, patch) {
    setProds(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
    await supabase.from('cult_productions').update(patch).eq('id', id)
  }
  async function deleteProduction(id) {
    if (!window.confirm('למחוק את ההפקה?')) return
    await supabase.from('cult_productions').delete().eq('id', id)
    setProds(prev => prev.filter(p => p.id !== id))
    setMenuFor(null)
  }
  async function saveAspect() {
    const { prod, key } = aspectEdit
    const aspects = { ...(prod.aspects || {}), [key]: aspectDraft }
    await supabase.from('cult_productions').update({ aspects }).eq('id', prod.id)
    setProds(prev => prev.map(p => p.id === prod.id ? { ...p, aspects } : p))
    setAspectEdit(null)
  }

  // ---- crew window ----
  const crewDefOf = ctx => (ctx && ctx.kind === 'day' ? { rows: OP_ROWS, label: 'צוות תפעול' } : { rows: CREW_ROWS, label: 'צוות' })
  function openCrew(prod) {
    const ctx = { kind: 'prod', prod }
    setCrewCtx(ctx)
    const c = prod.aspects?.crew || {}
    setCrew(Object.fromEntries(CREW_ROWS.map(r => [r.key, c[r.key] || []])))
    setCrewAdd(Object.fromEntries(CREW_ROWS.map(r => [r.key, ''])))
    setCrewEditing(null)
  }
  function openDayOpCrew(ds) {
    const ctx = { kind: 'day', ds }
    setCrewCtx(ctx)
    const c = (config.op_crew || {})[ds] || {}
    setCrew(Object.fromEntries(OP_ROWS.map(r => [r.key, c[r.key] || []])))
    setCrewAdd(Object.fromEntries(OP_ROWS.map(r => [r.key, ''])))
    setCrewEditing(null)
  }
  async function saveCrew(next) {
    if (!crewCtx) return
    if (crewCtx.kind === 'day') {
      const oc = { ...(config.op_crew || {}), [crewCtx.ds]: next }
      setConfig(c => ({ ...c, op_crew: oc }))
      await supabase.from('cult_config').update({ op_crew: oc, updated_at: new Date().toISOString() }).eq('id', 1)
    } else {
      const prod = crewCtx.prod
      const aspects = { ...(prod.aspects || {}), crew: next }
      await supabase.from('cult_productions').update({ aspects }).eq('id', prod.id)
      setProds(prev => prev.map(p => p.id === prod.id ? { ...p, aspects } : p))
      setCrewCtx(cc => (cc && cc.kind === 'prod' ? { ...cc, prod: { ...cc.prod, aspects } } : cc))
    }
  }
  function mutateCrew(next) { setCrew(next); saveCrew(next) }
  function addCrew(row) {
    const name = (crewAdd[row] || '').trim(); if (!name) return
    mutateCrew({ ...crew, [row]: [...(crew[row] || []), { id: newTagId(), name, status: 'white', note: '' }] })
    setCrewAdd(a => ({ ...a, [row]: '' }))
  }
  function updateTag(row, id, patch) {
    mutateCrew({ ...crew, [row]: crew[row].map(t => t.id === id ? { ...t, ...patch } : t) })
  }
  function deleteTag(row, id) {
    mutateCrew({ ...crew, [row]: crew[row].filter(t => t.id !== id) })
    setCrewEditing(null)
  }

  // ---- gear window (equipment spec) ----
  function openGear(prod) {
    setGearFor(prod)
    setGear(prod.aspects?.gear || [])
    setGearOpenCat(null); setGearOpenSub(null)
  }
  async function saveGear(next) {
    const aspects = { ...(gearFor.aspects || {}), gear: next }
    await supabase.from('cult_productions').update({ aspects }).eq('id', gearFor.id)
    setProds(prev => prev.map(p => p.id === gearFor.id ? { ...p, aspects } : p))
    setGearFor(gf => gf ? { ...gf, aspects } : gf)
  }
  const inGear = itemId => gear.some(g => g.equipment_item_id === itemId)
  function toggleGear(item) {
    const exists = gear.some(g => g.equipment_item_id === item.id)
    const next = exists ? gear.filter(g => g.equipment_item_id !== item.id) : [...gear, { equipment_item_id: item.id, quantity: '1' }]
    setGear(next); saveGear(next)
  }
  const gearMatch = (g, entry) => entry.manual ? (g.manual && g.id === entry.id) : (!g.manual && g.equipment_item_id === entry.equipment_item_id)
  function updateGearQty(entry, qty) { setGear(prev => prev.map(g => gearMatch(g, entry) ? { ...g, quantity: qty } : g)) }
  function removeGearEntry(entry) {
    const next = gear.filter(g => !gearMatch(g, entry))
    setGear(next); saveGear(next)
  }
  function addManualGear() {
    const name = (manualName || '').trim(); if (!name) return
    const next = [...gear, { manual: true, id: newTagId(), name, quantity: (manualQty || '1') }]
    setGear(next); saveGear(next)
    setManualName(''); setManualQty('')
  }

  // ---- times window (rundown) ----
  function openTimes(prod) {
    setTimesFor(prod)
    setTimes(prod.aspects?.times || [])
  }
  async function saveTimes(next) {
    const aspects = { ...(timesFor.aspects || {}), times: next }
    await supabase.from('cult_productions').update({ aspects }).eq('id', timesFor.id)
    setProds(prev => prev.map(p => p.id === timesFor.id ? { ...p, aspects } : p))
    setTimesFor(tf => tf ? { ...tf, aspects } : tf)
  }
  function addTimeRow() {
    const next = [...times, { id: newTagId(), time: '', what: '', who: '', notes: '' }]
    setTimes(next); saveTimes(next)
  }
  function updateTimeLocal(id, field, val) { setTimes(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r)) }
  function deleteTimeRow(id) {
    const next = times.filter(r => r.id !== id)
    setTimes(next); saveTimes(next)
  }
  function moveTimeRow(index, dir) {
    const next = [...times]; const j = index + dir
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    setTimes(next); saveTimes(next)
  }

  // ---- edit production ----
  function openEdit(p) { setEditProd(p); setEditName(p.name || ''); setEditArtist(p.artist || ''); setEditVenue(p.venue || ''); setEditTime(p.time || ''); setEditKind(p.kind || 'production') }
  async function saveEdit() {
    if (!editProd) return
    await updateProduction(editProd.id, { name: editName.trim(), artist: editArtist.trim(), venue: editVenue || null, time: editTime || null, kind: editKind })
    setEditProd(null)
  }

  // ---- day summaries ----
  function dayGearConflicts(ds) {
    const map = {}
    prods.filter(p => p.date === ds).forEach(p => (p.aspects?.gear || []).forEach(g => {
      const qty = parseInt(g.quantity || 0) || 0
      if (!map[g.equipment_item_id]) map[g.equipment_item_id] = { total: 0, entries: [] }
      map[g.equipment_item_id].total += qty
      map[g.equipment_item_id].entries.push({ name: p.name, qty })
    }))
    return Object.entries(map).map(([itemId, d]) => {
      const item = allItems.find(i => i.id === itemId)
      const stock = item?.units ? parseInt(item.units) : null
      return { item, total: d.total, entries: d.entries, stock, over: stock != null && d.total > stock }
    }).filter(x => x.item).sort((a, b) => (b.over ? 1 : 0) - (a.over ? 1 : 0) || b.total - a.total)
  }
  function dayCrewByKey(ds, key, rows) {
    const byName = {}
    prods.filter(p => p.date === ds).forEach(p => {
      const c = p.aspects?.[key] || {}
      rows.forEach(r => (c[r.key] || []).forEach(t => {
        if (!t.name) return
        if (!byName[t.name]) byName[t.name] = []
        byName[t.name].push({ role: r.label, prod: p.name, prodId: p.id, rowKey: r.key, tagId: t.id, status: t.status, note: t.note })
      }))
    })
    return byName
  }
  async function setProdCrewTagStatus(prodId, rowKey, tagId, status) {
    const prod = prods.find(p => p.id === prodId)
    if (!prod) return
    const crewObj = prod.aspects?.crew || {}
    const rowArr = (crewObj[rowKey] || []).map(t => t.id === tagId ? { ...t, status } : t)
    const aspects = { ...(prod.aspects || {}), crew: { ...crewObj, [rowKey]: rowArr } }
    setProds(prev => prev.map(p => p.id === prodId ? { ...p, aspects } : p))
    await supabase.from('cult_productions').update({ aspects }).eq('id', prodId)
  }
  function dayCrew(ds) { return dayCrewByKey(ds, 'crew', CREW_ROWS) }
  function dayCrewConfirmed(ds) {
    const byName = dayCrewByKey(ds, 'crew', CREW_ROWS)
    return Object.keys(byName).filter(n => byName[n].some(e => e.status === 'yellow'))
  }
  function dayOpCrew(ds) {
    const c = (config.op_crew || {})[ds] || {}
    const names = []
    OP_ROWS.forEach(r => (c[r.key] || []).forEach(t => { if (t.name && t.status === 'yellow' && !names.includes(t.name)) names.push(t.name) }))
    return names
  }
  async function saveDayNote(ds, val) {
    const dn = { ...(config.day_notes || {}), [ds]: val }
    setConfig(c => ({ ...c, day_notes: dn }))
    await supabase.from('cult_config').update({ day_notes: dn, updated_at: new Date().toISOString() }).eq('id', 1)
  }

  // ---- PDF exports ----
  function exportBoard() {
    const ds2 = dateRange(config?.date_from, config?.date_to)
    const rows = ds2.map(d => {
      const dayProds = prods.filter(p => p.date === d).sort((a, b) => sortKey(a) - sortKey(b))
      const ph = dayProds.length ? dayProds.map(p => `${esc(p.time || '')} ${p.venue ? '· ' + esc(p.venue) : ''} — <b>${esc(p.name)}</b>${p.artist ? ' / ' + esc(p.artist) : ''}`).join('<br>') : '<span class="muted">—</span>'
      const crew = dayCrewConfirmed(d).join(', ') || '—'
      const op = dayOpCrew(d).join(', ') || '—'
      const note = (config.day_notes || {})[d] || ''
      return `<tr><td><b>${dayName(d)}</b><br>${fmtCell(d)}</td><td>${ph}</td><td>${esc(crew)}</td><td>${esc(op)}</td><td>${esc(note)}</td></tr>`
    }).join('')
    printExport(config.title || 'פולחן הסתיו', `<table><thead><tr><th>יום</th><th>הפקות</th><th>צוות (אישרו)</th><th>צוות תפעול</th><th>הערות</th></tr></thead><tbody>${rows}</tbody></table>`)
  }
  function exportCrew() {
    if (!crewCtx) return
    const def = crewDefOf(crewCtx)
    const title = `${def.label} — ${crewCtx.kind === 'day' ? dayName(crewCtx.ds) + ' ' + fmtCell(crewCtx.ds) : crewCtx.prod.name}`
    const html = def.rows.map(r => {
      const items = (crew[r.key] || []).map(t => `${esc(t.name)} <span class="muted">(${cultStatus(t.status).label})</span>${(t.note || '').trim() ? ' — ' + esc(t.note) : ''}`).join('<br>') || '<span class="muted">—</span>'
      return `<h2>${esc(r.label)}</h2><div>${items}</div>`
    }).join('')
    printExport(title, html)
  }
  function exportGear() {
    if (!gearFor) return
    const rows = gear.map(g => {
      if (g.manual) return `<tr><td>${esc(g.name)}</td><td>${esc(g.quantity || '')}</td><td class="muted">ידני</td></tr>`
      const item = allItems.find(i => i.id === g.equipment_item_id); if (!item) return ''
      const sub = subcats.find(s => s.id === item.subcategory_id)
      return `<tr><td>${esc(item.name)}</td><td>${esc(g.quantity || '')}</td><td class="muted">${esc(sub?.name || '')}</td></tr>`
    }).join('')
    printExport(`ציוד — ${gearFor.name}`, `<table><thead><tr><th>פריט</th><th>כמות</th><th>קטגוריה</th></tr></thead><tbody>${rows}</tbody></table>`)
  }
  function exportTimes() {
    if (!timesFor) return
    const rows = times.map(r => `<tr><td>${esc(r.time || '')}</td><td>${esc(r.what || '')}</td><td>${esc(r.who || '')}</td><td>${esc(r.notes || '')}</td></tr>`).join('')
    printExport(`זמנים — ${timesFor.name}`, `<table><thead><tr><th>שעה</th><th>מה</th><th>מי</th><th>הערות</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  if (checking) return <div dir="rtl" className="p-8 text-center text-gray-400">טוען...</div>
  if (!allowed) return (
    <div dir="rtl" className="p-10 text-center">
      <div className="text-gray-700 font-semibold">אין הרשאה</div>
      <div className="text-gray-400 text-sm mt-1">האזור הזה בפיתוח וזמין רק למנהל המערכת.</div>
    </div>
  )
  if (!config) return <div dir="rtl" className="p-8 text-center text-gray-400">טוען...</div>

  const dates = dateRange(config?.date_from, config?.date_to)
  const venues = config?.venues || []
  const timeToMin = t => { if (!t) return 99999; const m = String(t).match(/(\d{1,2}):(\d{2})/); return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 99999 }
  const sortKey = p => (p.manual_order != null ? p.manual_order : timeToMin(p.time))
  const cellProds = date => prods.filter(p => p.date === date && (kindFilter === 'all' || (p.kind || 'production') === kindFilter)).sort((a, b) => sortKey(a) - sortKey(b))
  const isWeekend = ds => { const dow = new Date(ds + 'T00:00:00').getDay(); return dow === 5 || dow === 6 }

  function onCardDrop(date, targetId) {
    const id = dragId.current
    dragId.current = null
    if (!id || id === targetId) return
    const dragged = prods.find(p => p.id === id)
    if (!dragged || dragged.date !== date) return // גרירה רק בתוך אותו יום
    const col = prods.filter(p => p.date === date).sort((a, b) => sortKey(a) - sortKey(b))
    const ids = col.map(p => p.id).filter(x => x !== id)
    const ti = ids.indexOf(targetId)
    if (ti < 0) return
    ids.splice(ti, 0, id)
    const orderMap = {}; ids.forEach((pid, i) => { orderMap[pid] = i })
    setProds(prev => prev.map(p => p.id in orderMap ? { ...p, manual_order: orderMap[p.id] } : p))
    Promise.all(ids.map((pid, i) => supabase.from('cult_productions').update({ manual_order: i }).eq('id', pid)))
  }

  return (
    <div dir="rtl" className="p-4 md:p-6 max-w-full">
      {/* header / config */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input value={config.title || ''} onChange={e => setConfig(c => ({ ...c, title: e.target.value }))} onBlur={e => saveConfig({ title: e.target.value })}
          className="text-xl md:text-2xl font-bold text-[#E0197D] bg-transparent outline-none border-b border-transparent focus:border-[#E0197D] flex-1 min-w-[200px]" />
        <span className="text-[11px] text-gray-400 border border-[#EFC0D9] rounded-full px-2 py-0.5">בפיתוח · גלוי רק לך</span>
        <button onClick={exportBoard} className="text-[12px] px-3 py-1.5 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] flex items-center gap-1">
          <i className="ti ti-file-type-pdf" style={{ fontSize: 14 }} /> ייצוא PDF
        </button>
      </div>

      <div className="bg-white border border-[#F5D3E7] rounded-xl p-3 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">מתאריך</label>
          <input type="date" value={config.date_from || ''} onChange={e => saveConfig({ date_from: e.target.value || null })}
            className="text-[13px] px-2 py-1.5 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
        </div>
        <div>
          <label className="text-[11px] text-gray-400 block mb-1">עד תאריך</label>
          <input type="date" value={config.date_to || ''} onChange={e => saveConfig({ date_to: e.target.value || null })}
            className="text-[13px] px-2 py-1.5 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
        </div>
        <div className="flex-1 min-w-[200px] flex items-end justify-between gap-2 flex-wrap">
          <div>
            <label className="text-[11px] text-gray-400 block mb-1">תצוגה</label>
            <div className="flex items-center border border-[#E0197D] rounded-lg overflow-hidden">
              {[['all', 'הכל'], ['production', 'הפקות'], ['action', 'פעולות']].map(([v, l]) => (
                <button key={v} onClick={() => setKindFilter(v)} className={`text-[12px] px-3 py-1.5 ${kindFilter === v ? 'bg-[#E0197D] text-white' : 'bg-white text-[#E0197D] hover:bg-[#FCE4F3]'}`}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={() => setShowVenues(s => !s)} className="text-[12px] text-gray-500 hover:text-[#E0197D] flex items-center gap-1 pb-1.5">
            <i className="ti ti-settings" style={{ fontSize: 14 }} /> אולמות
          </button>
        </div>
      </div>

      {showVenues && (
        <div className="bg-white border border-[#F5D3E7] rounded-xl p-3 mb-4">
          <label className="text-[11px] text-gray-400 block mb-1.5">ניהול אולמות (לבורר בכרטיס)</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {venues.map(v => (
              <span key={v} className="text-[12px] bg-[#FCE4F3] text-[#A0106A] rounded-lg px-2 py-1 flex items-center gap-1">
                {v}
                <button onClick={() => removeVenue(v)} className="hover:text-red-500"><i className="ti ti-x" style={{ fontSize: 12 }} /></button>
              </span>
            ))}
            <input value={newVenue} onChange={e => setNewVenue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addConfigVenue() }}
              placeholder="+ אולם" className="text-[12px] px-2 py-1 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] w-24" />
          </div>
        </div>
      )}

      {/* grid */}
      {(!config.date_from || !config.date_to) ? (
        <div className="bg-white border border-[#F5D3E7] rounded-xl p-8 text-center text-[13px] text-gray-400">בחר טווח תאריכים כדי להציג את הלוח</div>
      ) : (
        <div className="overflow-x-auto border border-black rounded-xl">
          <table className="border-collapse w-full">
            <thead>
              <tr className="bg-[#B6CFD0]">
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  return (
                    <th key={ds} className={`border border-[#E7A9C8] ${we ? 'px-1 py-2 w-9 min-w-[34px]' : 'px-3 py-2 min-w-[160px]'}`}>
                      {we ? (
                        <>
                          <div className="text-[11px] font-bold text-gray-500">{dayName(ds).replace('יום ', '')}׳</div>
                          <div className="text-[9px] text-gray-400 whitespace-nowrap">{ds.split('-')[2]}/{ds.split('-')[1]}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[12px] font-bold text-gray-800">{fmtCell(ds)}</div>
                          <div className="text-[11px] text-gray-600">{dayName(ds)}</div>
                        </>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  return (
                    <td key={ds} className={`border border-[#EFC0D9] align-top ${we ? 'p-0.5 w-9 min-w-[34px] bg-gray-50/50' : 'p-1.5 min-w-[160px]'}`}>
                      <div className="flex flex-col gap-1">
                        {cellProds(ds).map(p => {
                          const k = kindOf(p)
                          return (
                          <div key={p.id} className="relative"
                            draggable onDragStart={() => { dragId.current = p.id }} onDragEnd={() => { dragId.current = null; setDragOverId(null) }}
                            onDragOver={e => { e.preventDefault(); if (dragId.current && dragId.current !== p.id) setDragOverId(p.id) }}
                            onDragLeave={() => setDragOverId(prev => (prev === p.id ? null : prev))}
                            onDrop={() => { onCardDrop(ds, p.id); setDragOverId(null) }}>
                            {dragOverId === p.id && <div className="h-0.5 bg-[#E0197D] rounded-full mb-1" />}
                            <button onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                              style={{ backgroundColor: k.bg, borderColor: k.border }}
                              className="w-full text-right border rounded-lg px-2 py-1.5 hover:brightness-95 transition cursor-grab active:cursor-grabbing">
                              {(p.time || p.venue) && (
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  {p.time && <span className="text-[11px] font-mono font-bold text-[#A0106A]">{p.time}</span>}
                                  {p.venue && <span className="text-[10px] bg-[#B6CFD0] text-gray-700 rounded px-1.5 py-0.5 mr-auto">{p.venue}</span>}
                                </div>
                              )}
                              <div className="text-[12px] font-medium text-gray-800 leading-tight">{p.name || '(ללא שם)'}</div>
                              {p.artist && <div className="text-[11px] text-gray-500 leading-tight">{p.artist}</div>}
                            </button>
                            {menuFor === p.id && (
                              <div className="absolute z-20 mt-1 right-0 bg-white border border-[#EFC0D9] rounded-xl shadow-lg p-1 w-48">
                                <div className="px-2 py-1 flex items-center justify-between">
                                  <div className="flex gap-1">
                                    <button onClick={() => { openEdit(p); setMenuFor(null) }} className="text-gray-300 hover:text-[#E0197D]"><i className="ti ti-pencil" style={{ fontSize: 13 }} /></button>
                                    <button onClick={() => deleteProduction(p.id)} className="text-gray-300 hover:text-red-500"><i className="ti ti-trash" style={{ fontSize: 13 }} /></button>
                                  </div>
                                  <span className="text-[11px] text-gray-400">{p.name}</span>
                                </div>
                                {ASPECTS.map(a => {
                                  const has = a.key === 'crew'
                                    ? ['operation','setup','strike'].some(k => (((p.aspects||{}).crew||{})[k]||[]).length)
                                    : a.key === 'gear'
                                    ? ((p.aspects||{}).gear||[]).length
                                    : a.key === 'times'
                                    ? ((p.aspects||{}).times||[]).length
                                    : ((p.aspects || {})[a.key] || '').trim()
                                  return (
                                    <button key={a.key} onClick={() => { if (a.key === 'crew') { openCrew(p) } else if (a.key === 'gear') { openGear(p) } else if (a.key === 'times') { openTimes(p) } else { setAspectEdit({ prod: p, key: a.key }); setAspectDraft((p.aspects || {})[a.key] || '') } setMenuFor(null) }}
                                      className="w-full text-right px-2 py-1.5 rounded-lg text-[13px] text-gray-700 hover:bg-[#FCE4F3] flex items-center gap-2 flex-row-reverse">
                                      <i className={`ti ${a.icon}`} style={{ fontSize: 14 }} />
                                      <span className="flex-1">{a.label}</span>
                                      {has && <span className="w-1.5 h-1.5 rounded-full bg-[#E0197D]" />}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          )
                        })}
                        <button onClick={() => { setAddCell({ date: ds }); setAddName(''); setAddArtist(''); setAddVenue(''); setAddTime(''); setAddKind(kindFilter === 'action' ? 'action' : 'production') }}
                          title={we ? 'הוסף הפקה' : undefined}
                          className={`text-gray-400 hover:text-[#E0197D] border border-dashed border-[#EFC0D9] hover:border-[#E0197D] rounded-lg flex items-center justify-center gap-1 ${we ? 'py-0.5 text-[10px]' : 'py-1 text-[11px]'}`}>
                          <i className="ti ti-plus" style={{ fontSize: 12 }} />{!we && ' הפקה'}
                        </button>
                      </div>
                    </td>
                  )
                })}
              </tr>
              {/* daily summary — aligned columns under each day */}
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  if (we) return <td key={ds} className="border border-[#EFC0D9] border-t-2 border-t-[#B6CFD0] bg-gray-50/50" />
                  const names = dayCrewConfirmed(ds)
                  const opNames = dayOpCrew(ds)
                  return (
                    <td key={ds} className="border border-[#EFC0D9] border-t-2 border-t-[#B6CFD0] align-top p-1.5 min-w-[160px] bg-[#F6FBFB]">
                      <button onClick={() => setCrewDayFor({ ds, mode: 'crew' })} className="w-full text-right mb-1.5">
                        <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><i className="ti ti-users" style={{ fontSize: 11 }} /> צוות ({names.length})</div>
                        <div className="text-[11px] text-gray-700 leading-snug break-words">{names.length ? names.join(', ') : <span className="text-gray-300">—</span>}</div>
                      </button>
                      <button onClick={() => openDayOpCrew(ds)} className="w-full text-right pt-1.5 border-t border-[#F5D3E7] hover:bg-[#FCE4F3] rounded-b">
                        <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1"><i className="ti ti-briefcase" style={{ fontSize: 11 }} /> צוות תפעול ({opNames.length})</div>
                        <div className="text-[11px] text-gray-700 leading-snug break-words">{opNames.length ? opNames.join(', ') : <span className="text-gray-300">— לחץ לשיבוץ</span>}</div>
                      </button>
                    </td>
                  )
                })}
              </tr>
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  if (we) return <td key={ds} className="border border-[#EFC0D9] bg-gray-50/50" />
                  return (
                    <td key={ds} className="border border-[#EFC0D9] align-top p-1 min-w-[160px]">
                      <textarea defaultValue={(config.day_notes || {})[ds] || ''} onBlur={e => saveDayNote(ds, e.target.value)}
                        placeholder="הערות יום…" rows={2}
                        className="w-full text-[11px] px-2 py-1 border border-[#F5D3E7] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
                    </td>
                  )
                })}
              </tr>
              <tr>
                {dates.map(ds => {
                  const we = isWeekend(ds)
                  if (we) return <td key={ds} className="border border-[#EFC0D9] bg-gray-50/50" />
                  return (
                    <td key={ds} className="border border-[#EFC0D9] p-1.5 min-w-[160px]">
                      <button onClick={() => setConflictDay(ds)} className="w-full text-[11px] px-2 py-1 rounded-lg border border-[#E0197D] text-[#E0197D] hover:bg-[#FCE4F3] flex items-center justify-center gap-1">
                        <i className="ti ti-alert-triangle" style={{ fontSize: 12 }} /> התנגשויות
                      </button>
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* add production modal */}
      {addCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setAddCell(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-gray-900 mb-1">{KIND[addKind].label} חדשה</div>
            <div className="text-[12px] text-gray-400 mb-3">{fmtCell(addCell.date)}</div>
            <div className="flex items-center border border-[#EFC0D9] rounded-lg overflow-hidden mb-3 text-[13px]">
              {['production', 'action'].map(kk => (
                <button key={kk} onClick={() => setAddKind(kk)}
                  className={`flex-1 py-1.5 ${addKind === kk ? (kk === 'action' ? 'bg-[#2563EB] text-white' : 'bg-[#E0197D] text-white') : 'bg-white text-gray-500'}`}>{KIND[kk].label}</button>
              ))}
            </div>
            <input value={addName} onChange={e => setAddName(e.target.value)} autoFocus placeholder="כותרת *"
              className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <input value={addArtist} onChange={e => setAddArtist(e.target.value)} placeholder="אמן / הרכב"
              className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <div className="flex gap-2 mb-3">
              <select value={addVenue} onChange={e => setAddVenue(e.target.value)}
                className="flex-1 text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right">
                <option value="">אולם…</option>
                {venues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="time" value={addTime} onChange={e => setAddTime(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') createProduction() }}
                className="w-28 text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
            </div>
            <div className="flex gap-2">
              <button onClick={createProduction} disabled={!addName.trim()} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">הוסף</button>
              <button onClick={() => setAddCell(null)} className="px-4 py-2 border border-[#EFC0D9] rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* aspect editor modal */}
      {aspectEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setAspectEdit(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <button onClick={() => setAspectEdit(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="text-[15px] font-semibold text-gray-900">{ASPECTS.find(a => a.key === aspectEdit.key)?.label} — {aspectEdit.prod.name}</div>
            </div>
            <div className="text-[11px] text-gray-400 mb-3 text-right">{ASPECTS.find(a => a.key === aspectEdit.key)?.hint}</div>
            <textarea value={aspectDraft} onChange={e => setAspectDraft(e.target.value)} rows={8} autoFocus
              placeholder="תוכן..." className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
            <div className="flex gap-2 mt-3">
              <button onClick={saveAspect} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A]">שמור</button>
              <button onClick={() => setAspectEdit(null)} className="px-4 py-2 border border-[#EFC0D9] rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}
      {/* crew window */}
      {crewCtx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => { setCrewCtx(null); setCrewEditing(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[85vh] overflow-y-auto" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => { setCrewCtx(null); setCrewEditing(null) }} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="flex items-center gap-3">
                <button onClick={exportCrew} className="text-[#E0197D] hover:text-[#A0106A]" title="ייצוא PDF"><i className="ti ti-file-type-pdf" style={{ fontSize: 16 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">{crewDefOf(crewCtx).label} — {crewCtx.kind === 'day' ? `${dayName(crewCtx.ds)} ${fmtCell(crewCtx.ds)}` : crewCtx.prod.name}</div>
              </div>
            </div>
            {crewDefOf(crewCtx).rows.map(row => (
              <div key={row.key} className="mb-4">
                <div className="text-[12px] font-semibold text-gray-600 mb-1.5 text-right">{row.label}</div>
                <div className="flex flex-wrap gap-1.5 items-center justify-end">
                  <div className="flex items-center gap-1">
                    <input value={crewAdd[row.key] || ''} onChange={e => setCrewAdd(a => ({ ...a, [row.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addCrew(row.key) }}
                      placeholder="שם" className="text-[12px] px-2 py-1 border border-dashed border-[#E7A9C8] rounded-lg outline-none focus:border-[#E0197D] w-24 text-right" />
                    <button onClick={() => addCrew(row.key)} disabled={!(crewAdd[row.key] || '').trim()}
                      className="text-[#E0197D] hover:bg-[#FCE4F3] rounded-lg p-1 disabled:opacity-30" title="הוסף">
                      <i className="ti ti-plus" style={{ fontSize: 16 }} /></button>
                  </div>
                  {(crew[row.key] || []).map(tag => {
                    const st = cultStatus(tag.status)
                    return (
                      <button key={tag.id} onClick={() => { setCrewEditing({ row: row.key, id: tag.id }); setStatusMenuOpen(false) }}
                        style={{ backgroundColor: st.bg, color: st.text }}
                        className="text-[12px] rounded-lg px-2.5 py-1 flex items-center gap-1">
                        {tag.name}
                        {(tag.note || '').trim() && <i className="ti ti-message-dots" style={{ fontSize: 11 }} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* crew tag editor (status + note) */}
      {crewCtx && crewEditing && (() => {
        const tag = (crew[crewEditing.row] || []).find(t => t.id === crewEditing.id)
        if (!tag) return null
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setCrewEditing(null)}>
            <div className="bg-white rounded-2xl w-full max-w-xs p-4" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setCrewEditing(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 16 }} /></button>
                <div className="text-[14px] font-semibold text-gray-800">{tag.name}</div>
              </div>
              <label className="text-[11px] text-gray-400 block mb-1 text-right">סטטוס</label>
              <div className="relative mb-3">
                <button onClick={() => setStatusMenuOpen(o => !o)}
                  style={{ backgroundColor: cultStatus(tag.status).bg, color: cultStatus(tag.status).text }}
                  className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg outline-none text-right font-medium flex items-center justify-between">
                  <i className={`ti ${statusMenuOpen ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 14 }} />
                  <span>{cultStatus(tag.status).label}</span>
                </button>
                {statusMenuOpen && (
                  <div className="absolute z-10 top-full mt-1 right-0 left-0 bg-white border border-[#EFC0D9] rounded-lg shadow-lg overflow-hidden">
                    {CULT_STATUSES.map(s => (
                      <button key={s.value} onClick={() => { updateTag(crewEditing.row, tag.id, { status: s.value }); setStatusMenuOpen(false) }}
                        style={{ backgroundColor: s.bg, color: s.text }}
                        className="w-full text-right px-3 py-2 text-[13px] font-medium hover:brightness-95 flex items-center justify-between gap-2">
                        {tag.status === s.value ? <i className="ti ti-check" style={{ fontSize: 13 }} /> : <span className="w-3" />}
                        <span className="flex-1">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea value={tag.note || ''} onChange={e => updateTag(crewEditing.row, tag.id, { note: e.target.value })}
                placeholder="הערה..." rows={3}
                className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y mb-3" />
              <div className="flex justify-between items-center">
                <button onClick={() => deleteTag(crewEditing.row, tag.id)} className="text-[12px] text-red-500 hover:underline flex items-center gap-1"><i className="ti ti-trash" style={{ fontSize: 13 }} /> מחק</button>
                <button onClick={() => setCrewEditing(null)} className="text-[13px] bg-[#E0197D] text-white px-4 py-1.5 rounded-lg hover:bg-[#A0106A]">סיום</button>
              </div>
            </div>
          </div>
        )
      })()}
      {/* gear window — equipment spec (like building a spec in Specs area) */}
      {gearFor && (() => {
        const gearDisplay = gear.map(g => {
          if (g.manual) return { ...g, manual: true, name: g.name }
          const item = allItems.find(i => i.id === g.equipment_item_id)
          const sub = subcats.find(s => s.id === item?.subcategory_id)
          const cat = categories.find(c => c.id === sub?.category_id)
          return item ? { ...g, item, sub, cat } : null
        }).filter(Boolean)
        const manualItems = gearDisplay.filter(s => s.manual)
        const gearByCat = categories.map(cat => ({ cat, items: gearDisplay.filter(s => !s.manual && s.cat?.id === cat.id) })).filter(x => x.items.length)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setGearFor(null)}>
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F5D3E7]">
                <button onClick={() => setGearFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
                <div className="flex items-center gap-3">
                  <button onClick={exportGear} className="text-[#E0197D] hover:text-[#A0106A]" title="ייצוא PDF"><i className="ti ti-file-type-pdf" style={{ fontSize: 16 }} /></button>
                  <div className="text-[15px] font-semibold text-gray-900">ציוד — {gearFor.name} <span className="text-[12px] text-gray-400 font-normal">({gear.length} פריטים)</span></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-4">
                {/* catalog */}
                <div className="w-full md:w-72 flex-shrink-0 bg-white border border-[#F5D3E7] rounded-xl overflow-hidden self-start">
                  <div className="text-[11px] font-semibold text-gray-500 px-3 py-2.5 bg-gray-50 border-b border-[#F5D3E7]">לקט ציוד</div>
                  {categories.map(cat => {
                    const catSubs = subcats.filter(s => s.category_id === cat.id)
                    const isOpen = gearOpenCat === cat.id
                    return (
                      <div key={cat.id}>
                        <button onClick={() => setGearOpenCat(isOpen ? null : cat.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-[12px] font-medium border-b border-gray-50 flex-row-reverse ${isOpen ? 'text-[#E0197D] bg-[#FCE4F3]' : 'text-gray-700 hover:bg-gray-50'}`}>
                          <span>{cat.name}</span>
                          <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-400`} style={{ fontSize: 11 }} />
                        </button>
                        {isOpen && catSubs.map(sub => {
                          const items = allItems.filter(i => i.subcategory_id === sub.id)
                          const isSubOpen = gearOpenSub === sub.id
                          return (
                            <div key={sub.id}>
                              <button onClick={() => setGearOpenSub(isSubOpen ? null : sub.id)}
                                className={`w-full flex items-center justify-between px-5 py-2 text-[11px] border-b border-gray-50 flex-row-reverse ${isSubOpen ? 'text-[#E0197D]' : 'text-gray-500 hover:bg-gray-50'}`}>
                                <span>{sub.name}</span>
                                <i className={`ti ${isSubOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-gray-300`} style={{ fontSize: 10 }} />
                              </button>
                              {isSubOpen && items.map(item => {
                                const on = inGear(item.id)
                                return (
                                  <button key={item.id} onClick={() => toggleGear(item)}
                                    className={`w-full flex items-center gap-2 px-6 py-1.5 text-[11px] border-b border-gray-50 flex-row-reverse text-right transition-colors ${on ? 'bg-[#E1F5EE] text-[#085041]' : 'text-gray-600 hover:bg-gray-50'}`}>
                                    <i className={`ti ${on ? 'ti-circle-check' : 'ti-circle-plus'} flex-shrink-0`} style={{ fontSize: 13, color: on ? '#22c55e' : '#E0197D' }} />
                                    <span className="flex-1 truncate">{item.name}</span>
                                    {item.units && <span className="text-gray-400">×{item.units}</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                {/* selected spec */}
                <div className="flex-1 min-w-0 bg-white border border-[#F5D3E7] rounded-xl overflow-hidden self-start">
                  {/* add manual item */}
                  <div className="flex items-center gap-2 p-2 bg-gray-50 border-b border-[#F5D3E7]">
                    <input value={manualName} onChange={e => setManualName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManualGear() }}
                      placeholder="פריט ידני (לא ברשימה)" className="flex-1 text-[12px] px-2 py-1.5 border border-[#EFC0D9] rounded-lg bg-white outline-none focus:border-[#E0197D] text-right" />
                    <input type="number" min="1" value={manualQty} onChange={e => setManualQty(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addManualGear() }}
                      placeholder="כמות" className="w-16 text-[12px] px-2 py-1.5 border border-[#EFC0D9] rounded-lg bg-white outline-none focus:border-[#E0197D] text-center" />
                    <button onClick={addManualGear} disabled={!manualName.trim()} className="bg-[#E0197D] text-white rounded-lg p-1.5 hover:bg-[#A0106A] disabled:opacity-30" title="הוסף פריט ידני">
                      <i className="ti ti-plus" style={{ fontSize: 15 }} /></button>
                  </div>
                  {gearDisplay.length === 0 ? (
                    <div className="text-center text-[13px] text-gray-400 py-10">
                      <div className="mb-1">אין פריטים</div>
                      <div className="text-[12px] text-gray-300">בחר מהקטלוג משמאל או הוסף פריט ידני למעלה</div>
                    </div>
                  ) : (<>
                    {gearByCat.map(({ cat, items }) => (
                    <div key={cat.id}>
                      <div className="px-4 py-2 bg-[#FCE4F3] text-[11px] font-semibold text-[#E0197D] text-right">{cat.name}</div>
                      {items.map(s => (
                        <div key={s.equipment_item_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                          <span className="flex-1 text-[13px] text-right text-gray-800">{s.item.name}</span>
                          {s.sub && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.sub.name}</span>}
                          <div className="flex flex-col items-center gap-0.5">
                            <input type="number" min="1" max={s.item.units ? parseInt(s.item.units) : undefined}
                              value={s.quantity || ''}
                              onChange={e => updateGearQty(s, e.target.value)}
                              onBlur={() => saveGear(gear)}
                              placeholder="כמות"
                              className={`w-16 text-[11px] px-2 py-1 border rounded-lg bg-white outline-none text-center ${s.item.units && parseInt(s.quantity) > parseInt(s.item.units) ? 'border-red-400 bg-red-50 text-red-600' : 'border-[#EFC0D9] focus:border-[#E0197D]'}`} />
                            {s.item.units && (
                              <span className={`text-[9px] ${parseInt(s.quantity) > parseInt(s.item.units) ? 'text-red-500 font-bold' : 'text-gray-400'}`}>מלאי: {s.item.units}</span>
                            )}
                          </div>
                          <button onClick={() => toggleGear(s.item)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <i className="ti ti-x" style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      ))}
                    </div>
                    ))}
                    {manualItems.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-[#FCE4F3] text-[11px] font-semibold text-[#E0197D] text-right">ידני / אחר</div>
                        {manualItems.map(s => (
                          <div key={'m:' + s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 flex-row-reverse group hover:bg-gray-50">
                            <span className="flex-1 text-[13px] text-right text-gray-800">{s.name}</span>
                            <input type="number" min="1" value={s.quantity || ''}
                              onChange={e => updateGearQty(s, e.target.value)} onBlur={() => saveGear(gear)}
                              placeholder="כמות" className="w-16 text-[11px] px-2 py-1 border border-[#EFC0D9] rounded-lg bg-white outline-none text-center focus:border-[#E0197D]" />
                            <button onClick={() => removeGearEntry(s)} className="text-gray-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                              <i className="ti ti-x" style={{ fontSize: 12 }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>)}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      {/* times window — rundown (like building a rundown in Rundowns area) */}
      {timesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setTimesFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#F5D3E7]">
              <button onClick={() => setTimesFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="flex items-center gap-3">
                <button onClick={exportTimes} className="text-[#E0197D] hover:text-[#A0106A]" title="ייצוא PDF"><i className="ti ti-file-type-pdf" style={{ fontSize: 16 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">זמנים — {timesFor.name}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-[#F5D3E7] rounded-xl overflow-hidden">
                <div className="grid gap-0 bg-[#E0197D] text-white text-[12px] font-semibold grid-cols-[100px_2fr_1.5fr_1fr_36px]">
                  <div className="px-3 py-2.5 text-right">שעה</div>
                  <div className="px-3 py-2.5 text-right border-r border-red-700">מה</div>
                  <div className="px-3 py-2.5 text-right border-r border-red-700">מי</div>
                  <div className="px-3 py-2.5 text-right border-r border-red-700">הערות</div>
                  <div className="px-2 py-2.5" />
                </div>
                {times.length === 0 && (
                  <div className="text-center text-[13px] text-gray-400 py-8">לחץ על "הוסף שורה" כדי להתחיל</div>
                )}
                {times.map((row, index) => (
                  <div key={row.id} className={`grid gap-0 border-b border-gray-50 group grid-cols-[100px_2fr_1.5fr_1fr_36px] ${index % 2 === 0 ? 'bg-white' : 'bg-[#FFF8F8]'}`}>
                    <textarea value={row.time || ''} onChange={e => updateTimeLocal(row.id, 'time', e.target.value)} onBlur={() => saveTimes(times)} wrap="off"
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-[#F5D3E7] font-mono resize-none w-full leading-5 whitespace-nowrap" rows={1} />
                    <textarea value={row.what || ''} onChange={e => updateTimeLocal(row.id, 'what', e.target.value)} onBlur={() => saveTimes(times)}
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-[#F5D3E7] resize-none w-full leading-5" rows={Math.max(1, Math.ceil((row.what || '').length / 30))} />
                    <textarea value={row.who || ''} onChange={e => updateTimeLocal(row.id, 'who', e.target.value)} onBlur={() => saveTimes(times)}
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-[#F5D3E7] resize-none w-full leading-5" rows={Math.max(1, Math.ceil((row.who || '').length / 20))} />
                    <textarea value={row.notes || ''} onChange={e => updateTimeLocal(row.id, 'notes', e.target.value)} onBlur={() => saveTimes(times)}
                      className="px-3 py-2 text-[13px] bg-transparent outline-none text-right border-l border-[#F5D3E7] text-gray-500 resize-none w-full leading-5" rows={Math.max(1, Math.ceil((row.notes || '').length / 20))} />
                    <div className="flex flex-col items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveTimeRow(index, -1)} disabled={index === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5"><i className="ti ti-chevron-up" style={{ fontSize: 11 }} /></button>
                      <button onClick={() => deleteTimeRow(row.id)} className="text-gray-300 hover:text-red-500 p-0.5"><i className="ti ti-trash" style={{ fontSize: 11 }} /></button>
                      <button onClick={() => moveTimeRow(index, 1)} disabled={index === times.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-20 p-0.5"><i className="ti ti-chevron-down" style={{ fontSize: 11 }} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={addTimeRow} className="w-full py-3 text-[13px] text-gray-400 hover:text-[#E0197D] hover:bg-[#FCE4F3] transition-colors flex items-center justify-center gap-1">
                  <i className="ti ti-plus" style={{ fontSize: 13 }} /> הוסף שורה
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* daily summary rows */}
      {/* edit production modal */}
      {editProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setEditProd(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-gray-900 mb-3">עריכת {KIND[editKind].label}</div>
            <div className="flex items-center border border-[#EFC0D9] rounded-lg overflow-hidden mb-3 text-[13px]">
              {['production', 'action'].map(kk => (
                <button key={kk} onClick={() => setEditKind(kk)}
                  className={`flex-1 py-1.5 ${editKind === kk ? (kk === 'action' ? 'bg-[#2563EB] text-white' : 'bg-[#E0197D] text-white') : 'bg-white text-gray-500'}`}>{KIND[kk].label}</button>
              ))}
            </div>
            <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus placeholder="כותרת *"
              className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <input value={editArtist} onChange={e => setEditArtist(e.target.value)} placeholder="אמן / הרכב"
              className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right mb-2" />
            <div className="flex gap-2 mb-3">
              <select value={editVenue} onChange={e => setEditVenue(e.target.value)}
                className="flex-1 text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right">
                <option value="">אולם…</option>
                {venues.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit() }}
                className="w-28 text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D]" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={!editName.trim()} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A] disabled:opacity-50">שמור</button>
              <button onClick={() => setEditProd(null)} className="px-4 py-2 border border-[#EFC0D9] rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* equipment conflicts for a day */}
      {conflictDay && (() => {
        const list = dayGearConflicts(conflictDay)
        const conflicts = list.filter(x => x.over).length
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setConflictDay(null)}>
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F5D3E7]">
                <button onClick={() => setConflictDay(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">התנגשויות ציוד — {dayName(conflictDay)} {fmtCell(conflictDay)}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {list.length === 0 ? (
                  <div className="text-center text-gray-400 py-10 text-[13px]">אין ציוד משובץ ליום זה</div>
                ) : (
                  <>
                    <div className={`text-[12px] mb-3 ${conflicts ? 'text-red-600 font-semibold' : 'text-green-700'}`}>
                      {conflicts ? `${conflicts} פריטים חורגים מהמלאי` : 'אין חריגות מלאי ✓'}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {list.map(row => (
                        <div key={row.item.id} className={`rounded-lg border px-3 py-2 ${row.over ? 'bg-red-50 border-red-200' : 'bg-white border-[#F5D3E7]'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {row.over && <i className="ti ti-alert-triangle text-red-500" style={{ fontSize: 14 }} />}
                              <span className="text-[13px] font-medium text-gray-800">{row.item.name}</span>
                            </div>
                            <span className={`text-[12px] ${row.over ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                              סה״כ {row.total}{row.stock != null ? ` / מלאי ${row.stock}` : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-1 text-right">{row.entries.map(e => `${e.name} (${e.qty})`).join(' · ')}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* crew of a day */}
      {crewDayFor && (() => {
        const cd = crewDayFor
        const def = CREW_MODES[cd.mode] || CREW_MODES.crew
        const byName = dayCrewByKey(cd.ds, def.key, def.rows)
        const names = Object.keys(byName).sort((a, b) => a.localeCompare(b, 'he'))
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setCrewDayFor(null)}>
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F5D3E7]">
                <button onClick={() => setCrewDayFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
                <div className="text-[15px] font-semibold text-gray-900">{def.label} — {dayName(cd.ds)} {fmtCell(cd.ds)} <span className="text-[12px] text-gray-400 font-normal">({names.length})</span></div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {names.length === 0 ? (
                  <div className="text-center text-gray-400 py-10 text-[13px]">אין צוות משובץ ליום זה</div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {names.map(name => {
                      const roles = byName[name]
                      const multi = roles.length > 1
                      return (
                        <div key={name} className={`rounded-lg border px-3 py-2 ${multi ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#F5D3E7]'}`}>
                          <div className="text-[13px] font-medium text-gray-800 flex items-center gap-2">
                            {name}
                            {multi && <span className="text-[10px] bg-amber-200 text-amber-800 rounded-full px-1.5">×{roles.length}</span>}
                          </div>
                          {roles.map((r, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 mt-1">
                              <StatusPicker status={r.status} onPick={st => setProdCrewTagStatus(r.prodId, r.rowKey, r.tagId, st)} />
                              <div className="text-[11px] text-gray-500 text-right flex-1">{r.role} · {r.prod}{(r.note || '').trim() ? ` — ${r.note}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* general notes for a day */}
      {dayNoteFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setDayNoteFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setDayNoteFor(null)} className="text-gray-400 hover:text-gray-600"><i className="ti ti-x" style={{ fontSize: 18 }} /></button>
              <div className="text-[15px] font-semibold text-gray-900">הערות יום — {dayName(dayNoteFor)} {fmtCell(dayNoteFor)}</div>
            </div>
            <textarea value={dayNoteDraft} onChange={e => setDayNoteDraft(e.target.value)} rows={8} autoFocus placeholder="הערות כלליות ליום זה..."
              className="w-full text-[13px] px-3 py-2 border border-[#EFC0D9] rounded-lg bg-gray-50 outline-none focus:border-[#E0197D] text-right resize-y" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => { saveDayNote(dayNoteFor, dayNoteDraft); setDayNoteFor(null) }} className="flex-1 bg-[#E0197D] text-white text-[13px] py-2 rounded-lg hover:bg-[#A0106A]">שמור</button>
              <button onClick={() => setDayNoteFor(null)} className="px-4 py-2 border border-[#EFC0D9] rounded-lg text-[13px] text-gray-500">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
