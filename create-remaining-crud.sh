#!/bin/bash
# Script pour créer toutes les routes CRUD restantes

echo "📝 Création des routes CRUD restantes..."

# Liste des routes à créer (format: entity/action method table_name)
routes=(
    "guests/get-guest GET guests"
    "guests/update-guest POST guests"
    "guests/delete-guest DELETE guests"
    "payments/get-payment GET payments"
    "payments/update-payment POST payments"
    "payments/delete-payment DELETE payments"
    "messages/get-message GET messages"
    "messages/update-message POST messages"
    "messages/delete-message DELETE messages"
    "notifications/get-notifications GET notifications"
    "notifications/get-notification GET notifications"
    "notifications/update-notification POST notifications"
    "notifications/delete-notification DELETE notifications"
    "contracts/create-contract POST contracts"
    "contracts/get-contracts GET contracts"
    "contracts/get-contract GET contracts"
    "contracts/update-contract POST contracts"
    "contracts/delete-contract DELETE contracts"
    "documents/create-document POST documents"
    "documents/get-documents GET documents"
    "documents/get-document GET documents"
    "documents/update-document POST documents"
    "documents/delete-document DELETE documents"
    "blog/create-post POST blog_posts"
    "blog/get-post GET blog_posts"
    "blog/update-post POST blog_posts"
    "blog/delete-post DELETE blog_posts"
    "testimonials/create-testimonial POST testimonials"
    "testimonials/get-testimonial GET testimonials"
    "testimonials/update-testimonial POST testimonials"
    "testimonials/delete-testimonial DELETE testimonials"
)

echo "✅ ${#routes[@]} routes à créer"
