import axios from 'axios';

export function api() {
  return axios.create({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
}

export function errorsOf(error) {
  return error?.response?.data?.fields || {};
}

export function messageOf(error, fallback) {
  return error?.response?.data?.error || fallback;
}
