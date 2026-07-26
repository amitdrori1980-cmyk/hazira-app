'use client'
// HAZIRA-RUNDOWN-VIEW-V2
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
function fmtDayHeader(ds){ if(!ds) return ''; const [y,m,d]=String(ds).split('-').map(Number); if(!y||!m||!d) return ''; const dt=new Date(y,m-1,d); return 'יום '+HE_DAYS[dt.getDay()]+' · '+d+' '+HE_MONTHS[m-1] }
function dayLabel(r){ return [fmtDayHeader(r.day_date), r.day_label].filter(Boolean).join(' · ') || 'יום' }

const HAZIRA_LOGO = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIHdpZHRoPSIyNDQuMjI5IiBoZWlnaHQ9IjI4NS4xNCIgdmlld0JveD0iMCAwIDI0NC4yMjkgMjg1LjE0Ij48Zz48Zz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSw1MS41MDc4LDE1Ny4yNDE3MikiIGQ9Ik0wIDBDMCAwIDE5LjYwNyAxNC4yMTMgMjcuMDE2IDE3LjczNyAzMy41NzUgMjAuODU3IDYwLjIyNyAzMC42NTEgNzQuMDIxIDMwLjIxNiA4Ni42OTEgMjkuODE2IDEwNi41MjEgMjMuMTIxIDExNi4zNjkgMTguMDU3IDEyOS44ODMgMTEuMTA5IDEzNi41NjMgNS4zMTQgMTQyLjc4My0uNDM4IDE0NS40MDEtMi44NiAxNDUuNzk3LTQuMjUzIDE0NS40MjkgLjU0NSAxNDQuOTggNi40MDMgMTQ1LjYzNiAxNy4zODggMTQ1LjQ3IDIzLjExNyAxNDUuNDAxIDI1LjUyMSAxNDQuNTc0IDMyLjI2NCAxNDQuMTMyIDMzLjc3IDE0Mi4wODUgNDAuNzU5IDEzNi45MzIgNTQuOTQyIDEzNi45MzIgNTQuOTQyIDEzNC45NzMgNjAuODY3IDEzNS4zODggNTAuNzkxIDEzNC42MzUgNDYuNzkxIDEzNC4yMjIgNDQuNiAxMzMuNTk4IDM5LjU2NyAxMzMuMzI4IDM3LjcyMiAxMzMuMDU3IDM1Ljg3NyAxMzEuOTMxIDMxLjQzOSAxMzEuMTU4IDI4LjE1MSAxMzAuMjA0IDI0LjA4OSAxMjkuNiAyNi45NzEgMTI5LjQ2MiAyOC41MzRMMTI3Ljk0NSA0NS44NDZDMTI3LjgwNyA0Ny40MDkgMTI3LjU3MSA0OS45NjcgMTI3LjQxOSA1MS41MjlMMTI1LjczMyA2OC45MTdDMTI1LjU4MiA3MC40NzkgMTI1LjE1IDczLjAwNCAxMjQuNzc0IDc0LjUyOEwxMTcuOTI4IDkzLjM2NUMxMTYuODQgOTcuMTMyIDExNi43ODEgOTQuMzg4IDExNi41MTEgOTMuMzc5IDExNi41MTEgOTMuMzc5IDExNi44MjMgODUuMTYzIDExNi4xMDIgODEuNjU2IDExNC43NjggNzUuMTcgMTEyLjQ4MiA2NC4xMzQgMTExLjcyMiA1OS43OTYgMTExLjM5MSA1Ny44OTkgMTEwLjcwOCA1NC44NSAxMDkuMjMgNTIuMDk1IDEwNy45MzkgNDkuNjg4IDEwNC42NDYgNDMuOTg3IDEwNC42NDYgNDMuOTg3IDEwMi44NTggNDAuOTAzIDEwMi45MTYgNDIuODE1IDEwMi42MjIgNDQuMzU2TDEwMS44NjIgNDguMzQzQzEwMS41NjkgNDkuODg1IDEwMS4zNyA1Mi40MzEgMTAxLjQyMiA1NEwxMDIuMDI1IDcyLjI5MUMxMDIuMDc3IDczLjg1OSAxMDEuOTUyIDc2LjQxNyAxMDEuNzQ3IDc3Ljk3M0w5Ny4yMzkgMTEyLjI2MUM5Ny4wMzYgMTEzLjgxOCA5Ni41MzMgMTE2LjMzMSA5Ni4xMjUgMTE3Ljg0Nkw4Ni4wNjggMTU0Ljk1N0M4NC43OTIgMTU5LjM4IDg0LjA2MyAxNTYuMjk0IDgzLjk5NyAxNTQuNzI3TDg0LjkyOCAxMTQuODdDODQuODYzIDExMy4zMDEgODQuNzg1IDExMC43MzQgODQuNzU3IDEwOS4xNjUgODQuNzU3IDEwOS4xNjUgODMuNDEzIDg0LjA0IDgzLjAwOSA3NS42ODUgODIuODQ0IDcyLjI3MSA4Mi42MTQgNzAuNzgyIDgyLjM2OCA2OS45MDRMNzcuNjg2IDUzLjk2N0M3Ny4xOTIgNTIuNDc2IDc2LjQ5NCA1Mi41MDYgNzYuMTMxIDU0LjAzM0w3NC44MDkgNTkuNjE0Qzc0LjQ0NiA2MS4xNDIgNzQuMTA2IDYzLjY3NSA3NC4wNTQgNjUuMjQ1TDczLjQ0NCA4My4yNEM3My4zOTIgODQuODA5IDczLjA3MSA4Ny4zNDcgNzIuNzMyIDg4Ljg3OUw2OS41OTggMTAzLjA4NkM2OS4yNTkgMTA0LjYxOSA2OC44ODEgMTA3LjE1NCA2OC43NTcgMTA4LjcxOSA2OC43NTcgMTA4LjcxOSA2Ni4yMTggMTM2LjAyMSA2Ni4wMiAxNDQuNzM0IDY1Ljk5MiAxNDUuOTIxIDY2LjM0NCAxNDkuMjY0IDY0LjcxNiAxNDUuMTMgNjQuNzE2IDE0NS4xMyA1NS43MzkgMTE5LjA0OSA1NC44ODcgMTE0LjM3IDU0LjAzNSAxMDkuNjkxIDUxLjgxMSA5MC4yOSA1MS44MTEgOTAuMjkgNTEuNzk2IDg4LjcyIDUxLjY0MiA4Ni4xNiA1MS40NyA4NC41OTlMNTAuMjcxIDczLjc1MkM1MC4wOTkgNzIuMTkyIDQ5Ljk3IDY5LjYzMSA0OS45ODYgNjguMDYyTDQ5Ljk4NCA0Ny4xOThDNTAuMDE4IDQ0LjIzNSA0OS44MDggNDQuNzA4IDQ4LjA1IDQ1Ljg1OSA0Ni45MDggNDYuNjA3IDQ1Ljc1NiA0OC42MTUgNDUuMzUzIDUwLjEzM0w0Mi4yMDQgNjEuNDA4QzQxLjggNjIuOTI1IDQxLjIzNiA2NS40MjggNDAuOTQ5IDY2Ljk3MkwzNy4yNjcgODYuNzU5QzM2Ljk3OSA4OC4zMDMgMzYuNjQ2IDkwLjg0NiAzNi41MjUgOTIuNDFMMzUuOTU1IDEwMy4yMjFDMzUuODM0IDEwNC43ODcgMzUuMzQ3IDEwNC44NDMgMzQuODczIDEwMy4zNDYgMzQuODczIDEwMy4zNDYgMjcuMTc3IDgxLjI5MiAyNS45MTcgNzUuMjA0IDI0LjY1OCA2OS4xMTYgMjMuNTA4IDU0LjQzMSAyMy41MDggNTQuNDMxIDIzLjQ3OCA1Mi44NiAyMy4yOTMgNTAuMzAyIDIzLjEgNDguNzQ2TDIxLjc3NiAzOC4xMzZDMjEuNTgyIDM2LjU3OCAyMS4wNjQgMzQuMDcxIDIwLjYyNiAzMi41NjNMMTguNTMyIDI3LjMzM0MxOC4wOTUgMjUuODI3IDE3LjExOCAyNS43MTkgMTYuMzYzIDI3LjA5NSAxNi4zNjMgMjcuMDk1IDE1LjA4NyAyNy43NjEgMTIuNzI2IDMzLjczMSAxMC4zNjUgMzkuNzAxIDExLjcxMyA1My40OTcgMTEuNzEzIDUzLjQ5NyAxMS43NjggNTUuOTUzIDExLjE0NCA1NS40MzcgMTAuMzM3IDUzLjQ3OSA5LjUzIDUxLjUyMSAyLjI1IDMzLjA5NSAuNTU3IDI2Ljg3NS0xLjEzNiAyMC42NTQtMi4xNDkgNC44My0yLjQyMyAxLjIyOC0yLjYzMy0xLjUyNi0zLjI4Mi0yLjYxNSAwIDAiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNDkuMDA5MiwyMTcuNjQ5NSkiIGQ9Ik0wIDBDLjQ5IDEuNDkxIDEuMzE2IDMuOTIzIDEuODQgNS40MDNMMS45OTQgNS44MzlDMi44MzggOC4zNDEgMy4xMzMgOC4wNzEgNC40OTIgNi4xMzNMNS4wMTMgNS4zMjdDNS44NjMgNC4wMDcgNy4zNzcgMS45MzcgOC4zNzUgLjcyNUwxMS44NjEtMy41MDdDMTMuNTc2LTUuODY3IDEzLjM0NC02LjI1NCAxNC43NjktMy4wNzRMMTkuNjUgOC42OTNDMjAuMjUyIDEwLjE0NCAyMS4wMTcgMTIuMjc0IDIxLjM1MSAxMy40MjkgMjEuNjg0IDE0LjU4MyAyMS45MyAxNS40MDkgMjQuMzgxIDE0LjAyMUwyNC41NDkgMTMuOTE3QzI1Ljg4MSAxMy4wODggMjcuNDM2IDExLjIxMiAyOC4wMDEgOS43NDlMMjkuMzA5IDYuMzcxQzI5Ljg3NSA0LjkwNiAyOS43ODEgMi42ODcgMzEuNzg5IDYuMTY3IDMxLjc4OSA2LjE2NyAzNC45NTMgMTEuNDI1IDM1LjU3NyAxMy4zNTkgMzYuMTU3IDE1LjE1NiAzNi4zNTcgMTcuMDE5IDM2LjU2NyAxOC41NzkgMzYuNTY3IDE4LjU3OSAzNi43MjggMjIuNDk2IDM2Ljc2MyAyMy44MSAzNi44MDUgMjUuMzggMzcuMzQ1IDI3Ljg4NSAzNy44MjQgMjkuMzc5TDM5LjAwOCAzMy4wNjFDMzkuOTEyIDM1LjI0NSA0MC4yNDcgMzUuNTUzIDM3LjY5MyAzMy45NDUgMzcuNjkzIDMzLjk0NSAyMy41MjIgMjMuMTI1IDE1Ljc5MSAyMC4xMTcgNC4yMjkgMTUuNjE2LTEzLjM2OSAxMS4wOC0yMy40OCA5Ljg2LTMwLjA5IDkuMDYyLTY2LjMwNSAxOS42NzQtNzEuMzAxIDIxLjU4Mi03Ni4zMzcgMjMuNTA1LTkxLjAxMiAzNC42NzktOTEuMDEyIDM0LjY3OS05My40ODcgMzYuNjgzLTkzLjExMSAzNi4yNjUtOTIuMTg4IDMzLjg0NUwtOTAuNDU2IDI5LjI3NkMtODkuOSAyNy44MDgtODkuNTE5IDI1LjMyNS04OS42MTEgMjMuNzU4TC04OS44MTUgMjAuMjg4Qy04OS45MDYgMTguNzIxLTg5LjY1IDE2LjE5OC04OS4yNDUgMTQuNjgxTC04Ny44NDggOS40NUMtODcuNDQyIDcuOTM1LTg3LjA3OSA2LjUzMi04NS45NDMgOS4yOTdMLTgzLjgwNiAxNC4wNjNDLTgzLjE2NCAxNS40OTUtODIuMDY3IDE3LjUwOC04MS4zNyAxOC41MzUtODAuNjc0IDE5LjU2Mi03OS44MiAxOS4xNDgtNzkuNDc1IDE3LjYxOEwtNzguMzUzIDEyLjYzNEMtNzguMDA4IDExLjEwMy03Ny4xOTIgOC42ODItNzYuNTQgNy4yNTRMLTcxLjc2LTMuMjIxQy03MC43NTgtNS4yMzEtNzAuNDc0LTUuNTM4LTY5Ljc5LTMuMDc0TC02OC4zODcgMS44MjdDLTY3Ljk1NSAzLjMzNi02Ni44MjEgNS41OTEtNjUuODY3IDYuODM3TC02NC4xMzQgOS4xQy02MS44MjYgMTIuNTQxLTYxLjcwOCAxMS4wMTMtNTkuNTg5IDguNTA4TC01Ny45MjEgNi4wMDRDLTU3LjA1MSA0LjY5Ny01NS45IDIuNDIxLTU1LjM2MyAuOTQ2TC01MS4zOTMtOS45NzVDLTUwLjcwNC0xMi4yNDYtNTEuMTc3LTE0LjIwNy00OC45NTYtMTAuMTQ0TC00NS41OC01LjIzN0MtNDQuNzIyLTMuOTIyLTQzLjQ0NC0xLjY5OS00Mi43MzktLjI5NkwtNDEuNjM3IDEuODk3Qy00MC45MzIgMy4yOTktMzguODUyIDQuMTM4LTM3LjU3MSAxLjkxNkwtMzYuNjk3IC4yMzhDLTM1Ljk3Mi0xLjE1NS0zNC4wNS00Ljc5LTMzLjM5Ny02LjU0My0zMi44NS04LjAxMy0zMS45NjktMTAuMjcyLTMxLjMwNC0xMS42OTRMLTI3LjYxMy0xOS4wMDNDLTI2LjU4OS0yMC42NDYtMjYuOTkxLTIzLjEwMy0yNS4zNDYtMTguOTM4TC0yMS40MjQtMTEuNDg2Qy0yMC44NDItMTAuMDI5LTE5LjgyMi01LjkwMS0xOS44MjItNS45MDEtMTguNjk2LTIuMzU5LTE4LjAzIDEuMzg4LTE3LjM5NCAxLjQxNy0xNi44NCAxLjQ0NC0xNC43NzUtMi4wMjItMTQuMDU0LTMuNjg4TC0xMy4zMzMtNS4xMThDLTEyLjgxMy02LjYtMTEuNjkyLTguODkyLTEwLjg0NC0xMC4yMTFMLTguNzE4LTEzLjUxMUMtNy4wMDEtMTYuMTY5LTcuMjA3LTE2LjY3LTUuOTM0LTEzLjM0TC0yLjMwNy01LjgyMUMtMS42MjQtNC40MDctLjY2NS0yLjAyOS0uMTc3LS41MzlaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMTAwLjA2NDksMTY3Ljg4OTcxKSIgZD0iTTAgMEMuMTQzIDguMzAxIDQuMTQyIDEyLjExMyA1LjYwNCAxMy43NSA5LjgwNCAxOC40NDYgMTUuNDIgMjEuNTE2IDIyLjAyNyAyMS41MTYgMjQuODU5IDIxLjUxNiAyNy40NzEgMjAuNzEgMzAuMDEzIDE5LjkxMyAzMy42MDQgMTguNzg2IDM0LjEwMiAxOC4zOTggMzQuNjI3IDE3LjgyNCAzNS4xMTMgMTcuMjkyIDM1LjU5OCAxNi40OTEgMzYuMjUxIDE1LjgxMyAzNi44MSAxNS4yMzEgMzcuMzYzIDE0LjY1IDM3LjkxMSAxNC4wNTkgMzguMDc0IDEzLjg4MyAzOC4yNTEgMTMuNzM1IDM4LjQwNiAxMy41OTUgNDEuMTczIDExLjExOSA0NC4yMjkgOC40IDQ0LjM4MiAwIDQ0LjUyLTcuNjM1IDM4LjM0My0xMy41MjQgMzguMzQzLTEzLjUyNCAzNy4yMDctMTQuNjA4IDM1Ljc2OS0xNi4xMSAzMy44OC0xNi44MDEgMzMuMTM3LTE3LjA3MyAzMS42MDQtMTcuNDg3IDMwLjg2OC0xNy43OCAyOC4xMDktMTguODc4IDI1LjM1OC0xOS44MjEgMjIuMTg5LTE5LjgyMSAyMi4wODctMTkuODIxIDIxLjc1NC0xOS44NTggMjEuMzk3LTE5Ljg1OCAyMS4wOTUtMTkuODU4IDE5LjQ1NC0xOS43OTEgMTguNTk3LTE5LjU4NyAxOC41OTctMTkuNTg3IDE3Ljk1NC0xOS40MzUgMTYuOTc2LTE5LjE0MiAxNS42NTQtMTguODA4IDE0LjM4Ni0xOC4zNSAxMy4xNzktMTcuNzc2IDExLjczNy0xNy4xNjEgMTAuMjYzLTE2LjM5OSA5LjExLTE1LjQ5MyAzLjkyNC0xMS40MTYtLjE2LTkuMjkyIDAgME0tNDkuMjUyLTEuNTgyQy00OS4yNTItMS41ODItMjYuMzk2LTE4LjMtMTcuMTM3LTIxLjg0NC03LjYzNS0yNS40ODEgMTYuMDIzLTMxLjM3IDI1LjQ1OS0zMS4zNTYgMzUuMDI1LTMxLjM0MSA1My43NTMtMjUuNjYyIDYyLjUyNS0yMS44NDQgNzEuMTE3LTE4LjEwNCA5NC42NDEtMS41ODIgOTQuNjQxLTEuNTgyIDk3LjQ1IC4xNTQgOTcuNTctLjU2NSA5NS4wMTQgMS4yMTRMOTMuNTY1IDIuMTY3QzkzLjU2NSAyLjE2NyA3NC41NjggMTUuOTI1IDY3LjY2NCAxOS41NTMgNTQuMTQyIDI2LjY1OSAyOC44ODEgMzEuOTYxIDIxLjc4OSAzMS45NTcgMTIuMjY0IDMxLjk1MS03Ljk3NCAyNC44NjItMTYuNzU5IDIxLjA3NS0yNS40NzcgMTcuMzE3LTQ5LjI1MiAxLjU4Mi00OS4yNTIgMS41ODItNTMuNTQzLS45NTktNTIuNzMgLjM4OS00OS4yNTItMS41ODIiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxMjIuMjQ3LDE3Ny43ODE4MikiIGQ9Ik0wIDBDNS44MTQgMCAxMC41NDIgNC43MyAxMC41NDIgMTAuNTQzIDEwLjU0MiAxNi4zNTYgNS44MTQgMjEuMDg1IDAgMjEuMDg1LTUuODEzIDIxLjA4NS0xMC41NDQgMTYuMzU2LTEwLjU0NCAxMC41NDMtMTAuNTQ0IDQuNzMtNS44MTMgMCAwIDAiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSw4MS44Mzc0LDI1MC4wMjA2MikiIGQ9Ik0wIDAtNS4zMS0yLjk2Mi0yLjM0Ny04LjI3MiAyLjk2Mi01LjMxWiIgZmlsbD0iIzJlMmQyYyIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDcxLjcxODIsMjc1LjAyMikiIGQ9Ik0wIDAgNy4xMjUtMS43OTQgMTEuMTA0IDE0Ljk3IDMuOTc5IDE2Ljc2NVoiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxODguMDk3MSwyNTEuMDIzMDEpIiBkPSJNMCAwIDUuMjYtMS45MTkgNS4zNzgtNy4xNTcgMTIuNDY0LTcuNDcxVi03LjQ1OEwxMi4yNzEgMi45NTggMi4xNTkgNi44NTVaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMTQ1Ljc4MTcsMjY5LjUxMjc0KSIgZD0iTTAgMCAyLjEyMy0xMS45MjkgMi4xMzYtMTEuOTI3IDkuNjE1LTEwLjYxMSA3LjQ5MSAxLjMxN1oiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNDMuNDEzNSwyNTguNDI4OCkiIGQ9Ik0wIDAgMS4zNDgtNy4yOTQgMTQuOTIxLTQuOTA4IDE3LjgzMy0yMC42NjcgMTcuODQ3LTIwLjY2NSAyNS4zMjUtMTkuMzQ5IDIxLjA2NCAzLjcwMloiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxNjguMTM0MiwyNTMuNjc2ODIpIiBkPSJNMCAwIDEuMzcyLTcuMjMyIDExLjQzLTQuMzQgMTUuODI2LTE5LjczOCAxNS44MzktMTkuNzM0IDIyLjk1My0xNy43MDMgMTYuNTIxIDQuODIyWiIgZmlsbD0iIzJlMmQyYyIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDIxMy4zMzkzLDI0NS40NTcxMykiIGQ9Ik0wIDAtLjAwNSAuMDA4LTMuMjAzIDIuNzAzIDEuMTU0IDYuNDUxLTMuMTg3IDEyLjcwOC05LjQ3MiA2LjQ5OC0xNS41MjYgNC44MjgtMTAuNTMxLTEuMTQ0LTcuMjgyLS4zMDItMy4xMjMtMTUuNDM4IDMuNjIyLTExLjM4IDMuNjIxLTExLjM3MVoiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwyNi43MjYsMjI4LjIwMTIyKSIgZD0iTTAgMC01LjU4Mi02LjY0OS0xMC43NTEtMi4zMS01LjE2MSA0LjMyNS0xMC44MDQgOS4zODMtMjYuNzI2LTkuNTE0LTIxLjA4My0xNC41NzMtMTUuNDg1LTcuOTI4LTEwLjMwNi0xMi4yNzYtMTUuODg5LTE4LjkyNS05Ljk0OS0yMy42MjYgNS45MzktNC43MDJaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsNzIuOTU3NSwyNTAuNzUzMDIpIiBkPSJNMCAwLTkuMDE0IDItMTguNzQyIDcuNDUzLTIwLjkxNiAuNDE5LTEzLjYwOS0zLjc0NC0yNy43NjItMTUuODMzLTE3LjUxOC0xNy4yNS01LjI5NS0yMy4wNzgtMy42MTEtMTUuNzIyLTEyLjAyOC0xMS42MTVaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMjE5LjkwMTgsMjQwLjAzNzYyKSIgZD0iTTAgMCA2LjgzNS0xMC4wMDUgNi44NDctOS45OTggMTMuMTI1LTUuNzI3IDYuMjkgNC4yNzhaIiBmaWxsPSIjMmUyZDJjIi8+PHBhdGggdHJhbnNmb3JtPSJtYXRyaXgoMSwwLDAsLTEsMjMwLjg3ODQsMjE4Ljg3OTAyKSIgZD0iTTAgMC0xNy42ODctMTIuMDI1LTEzLjQ2Mi0xOC4xMjItMi4wNjUtMTAuMzczIDcuMDYxLTIzLjU0NiA3LjA3MS0yMy41MzkgMTMuMzUxLTE5LjI2OFoiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwzOS4xMzYyLDI1Mi42ODIyMikiIGQ9Ik0wIDAtNiAxLjUzIDEuMDExIDguMDQgMS41MTUgNy43ODRaTTYuMTU2LTEuNzEyIDkuNDI0IDExLjQ1MS0uMjg1IDE2LjM0Ny0xOS4zMDgtMi4wNzQtMS4xNjgtNS45NTctMi4zNjUtMTAuMzU1IDMuMzkxLTEyLjcxOCA0Ljg1NC03LjEgMTAuMjU5LTIuNTk5WiIgZmlsbD0iIzJlMmQyYyIvPjxwYXRoIHRyYW5zZm9ybT0ibWF0cml4KDEsMCwwLC0xLDExOC45NTIxLDI3NS45NzcxKSIgZD0iTTAgMCAzLjM2OSA4Ljk1MyAzLjkzNCA4Ljk0OSA2LjA1MSAxLjMwN1pNLTEuNDk2IDE1LjgxLTEwLjMwMy05LjE2MyA3LjcyOC00Ljg2OCA4LjU1NC05LjAxNSAxNC43Ni04LjU2MyA5LjM3NiAxNS43NloiIGZpbGw9IiMyZTJkMmMiLz48cGF0aCB0cmFuc2Zvcm09Im1hdHJpeCgxLDAsMCwtMSwxMDkuOTA1NywyNjQuNzc4NCkiIGQ9Ik0wIDAtMjAuNzc2IDEyLjAwMS0yNi4yNTMtMTMuMTctMTkuMzgyLTE0LjcyLTE1LjgzMiAxLjE0OS0xMS4yNDctMS4wNS0xNC44MzgtNS4wMDMtMTIuMjc3LTcuNjQ5LTEyLjQ4MS03LjgyMS0xNC44MjctOS43Ny01LjY2Mi0xOS43NDItMy41MTQtMTIuNDUxLTcuNjYzLTcuODg4WiIgZmlsbD0iIzJlMmQyYyIvPjwvZz48L2c+PC9zdmc+'

export default function RundownPage({ params }) {
  const id = params?.id
  const [loading, setLoading] = useState(true)
  const [sch, setSch] = useState(null)
  const [rows, setRows] = useState([])

  useEffect(() => { if (id) load() }, [id])

  async function load() {
    setLoading(true)
    const { data: s } = await supabase.from('general_schedules').select('*').eq('id', id).single()
    if (!s) { setSch(null); setLoading(false); return }
    const { data: r } = await supabase.from('general_schedule_rows').select('*').eq('schedule_id', id).order('sort_order')
    setSch(s); setRows(r || []); setLoading(false)
  }

  function closeOrBack() {
    try { window.close() } catch (e) {}
    setTimeout(() => { if (!window.closed) window.location.href = '/dashboard/calendar' }, 120)
  }

  if (loading) return <div dir="rtl" className="min-h-screen flex items-center justify-center text-gray-400">טוען...</div>

  if (!sch) return (
    <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-gray-50">
      <img src={HAZIRA_LOGO} alt="הזירה" className="h-16 mb-4 opacity-80" />
      <div className="text-gray-700 font-semibold text-lg">הלוז לא נמצא</div>
      <div className="text-gray-400 text-sm mt-1">ייתכן שהקישור שגוי או שהלוז נמחק</div>
    </div>
  )

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 py-8 px-4">
      <style>{`@media print { .no-print { display:none !important } body { background:#fff } .sheet { box-shadow:none !important; border:none !important } } @page { margin:14mm 12mm }`}</style>
      <div className="max-w-3xl mx-auto">
        <div className="no-print flex items-center justify-between mb-3">
          <button onClick={closeOrBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-gray-600 hover:text-[#E0197D] border border-gray-200 hover:border-[#E0197D] bg-white px-4 py-2 rounded-lg">
            <i className="ti ti-arrow-right" style={{ fontSize: 15 }} /> חזרה ליומן
          </button>
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-[13px] text-white bg-[#E0197D] hover:bg-[#A0106A] px-4 py-2 rounded-lg">
            <i className="ti ti-printer" style={{ fontSize: 15 }} /> הדפס / שמור PDF
          </button>
        </div>

        <div className="sheet bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <header className="flex items-center justify-between gap-4 border-b-2 border-[#E0197D] p-5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold text-[#E0197D] tracking-wide mb-0.5">הזירה · לוז</div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight break-words">{sch.title}</h1>
              {sch.venue && <div className="text-[13px] text-gray-500 mt-1">{sch.venue}</div>}
              {sch.participants && <div className="text-[12px] text-gray-400 mt-1 break-words">משתתפים: {sch.participants}</div>}
            </div>
            <img src={HAZIRA_LOGO} alt="הזירה" className="h-14 w-auto flex-shrink-0" />
          </header>

          {rows.length === 0 ? (
            <div className="text-center text-gray-400 py-12">הלוז ריק</div>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="text-right font-semibold px-3 py-2 border-b border-gray-200 w-20">שעה</th>
                  <th className="text-right font-semibold px-3 py-2 border-b border-gray-200">מה</th>
                  <th className="text-right font-semibold px-3 py-2 border-b border-gray-200 w-40">מי</th>
                  <th className="text-right font-semibold px-3 py-2 border-b border-gray-200 w-48">הערות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => r.row_type === 'day' ? (
                  <tr key={r.id}>
                    <td colSpan={4} className="px-3 py-2 font-bold text-[#A0106A] bg-[#FCE4F3] border-b border-[#F3C9E2]">{dayLabel(r)}</td>
                  </tr>
                ) : (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2 border-b border-gray-100 font-mono whitespace-nowrap text-gray-700">{r.time || ''}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-900 whitespace-pre-wrap break-words">{r.what || ''}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-600 whitespace-pre-wrap break-words">{r.who || ''}</td>
                    <td className="px-3 py-2 border-b border-gray-100 text-gray-400 whitespace-pre-wrap break-words">{r.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <footer className="text-center text-[11px] text-gray-400 py-4 border-t border-gray-100">הזירה · מערכת ניהול הפקה</footer>
        </div>
      </div>
    </div>
  )
}
