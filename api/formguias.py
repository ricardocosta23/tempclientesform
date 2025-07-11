import os
import json
import logging
from flask import Blueprint, request, jsonify
from utils.monday_api import MondayAPI
from utils.form_generator import FormGenerator

formguias_bp = Blueprint('formguias', __name__)

@formguias_bp.route('/formguias', methods=['POST'])
def handle_formguias():
    """Handle webhook for Guias forms"""
    try:
        # Get webhook data
        data = request.get_json()

        # Handle Monday.com webhook challenge validation
        if data and 'challenge' in data:
            challenge = data['challenge']
            return jsonify({'challenge': challenge})

        webhook_data = data
        logging.info(f"Received webhook data for Guias: {webhook_data}")

        # Load configuration
        from flask import current_app
        config = current_app.load_config()

        guias_config = config.get('guias', {})

        if not guias_config.get('questions'):
            return jsonify({"error": "No questions configured for Guias"}), 400

        # Initialize Monday.com API
        monday_api = MondayAPI()

        # Fetch header data from Monday.com with specific columns
        header_data = {}
        if guias_config.get('board_a'):
            try:
                # Extract item ID from webhook data
                item_id = webhook_data.get('event', {}).get('pulseId')
                if item_id:
                    # Get specific item data from Monday.com using the working method
                    item_data = monday_api.get_item_column_values(item_id)

                    if item_data:
                        # Set Viagem as the item name
                        header_data['Viagem'] = item_data.get('name', '')

                        # Map specific columns to header fields
                        column_mapping = {
                            'lookup_mkrjh91x': 'Destino',
                            'lookup_mkrjpdz0': 'Data', 
                            'lookup_mkrb9ns5': 'Cliente'
                        }


                        # Extract column values
                        for column in item_data.get('column_values', []):
                            column_id = column.get('id')
                            if column_id in column_mapping:
                                header_field = column_mapping[column_id]
                                column_value = monday_api.get_column_value(column)
                                if column_value:
                                    header_data[header_field] = column_value

                        logging.info(f"Header data collected: {header_data}")
            except Exception as e:
                logging.error(f"Error fetching header data: {str(e)}")

        # Process questions and populate Monday column data
        processed_questions = []
        
        # Log all destination columns for debugging and ensure they're properly set
        print("\n=== GUIA FORMS - ALL DESTINATION COLUMNS ===")
        questions_without_destination = []
        
        for i, question in enumerate(guias_config['questions']):
            if question.get('type') != 'divider':
                dest_col = question.get('destination_column', '')
                question_dest_col = question.get('question_destination_column', '')
                q_type = question.get('type', '')
                q_id = question.get('id', '')
                q_text = question.get('text', '')[:50] + "..." if len(question.get('text', '')) > 50 else question.get('text', '')
                
                print(f"Question {i+1}: ID={q_id}, Type={q_type}")
                print(f"  Text: {q_text}")
                print(f"  Destination Column: '{dest_col}'")
                if question_dest_col:
                    print(f"  Question Destination Column: '{question_dest_col}'")
                print(f"  Source Column: '{question.get('source_column', '')}'")
                
                # Auto-assign destination columns if missing
                if not dest_col or dest_col.strip() == '':
                    # For Monday column questions, use source column as destination if not set
                    if q_type == 'monday_column' and question.get('source_column'):
                        question['destination_column'] = question['source_column']
                        dest_col = question['source_column']
                        print(f"  ✅ Auto-assigned destination column: '{dest_col}'")
                    else:
                        questions_without_destination.append(f"{q_id} ({q_type}): {q_text}")
                
                print("---")
        
        if questions_without_destination:
            print("⚠️  QUESTIONS WITHOUT DESTINATION COLUMNS:")
            for q in questions_without_destination:
                print(f"  - {q}")
        else:
            print("✅ All questions have destination columns configured")
            
        print("=== END DESTINATION COLUMNS LIST ===\n")
        
        for question in guias_config['questions']:
            processed_question = question.copy()

            # If it's a Monday column question, fetch the data
            if question.get('type') == 'monday_column' and question.get('source_column'):
                try:
                    # Extract item ID from webhook data
                    item_id = webhook_data.get('event', {}).get('pulseId')
                    source_column = question.get('source_column')

                    logging.info(f"Fetching Monday column data - Item ID: {item_id}, Column: {source_column}, Board: {guias_config['board_a']}")

                    if item_id and source_column and guias_config.get('board_a'):
                        try:
                            # Get specific item data from Monday.com
                            item_data = monday_api.get_item_column_values(item_id)

                            logging.info(f"Item data received: {item_data is not None}")
                            if item_data:
                                logging.info(f"Item columns: {[col.get('id') for col in item_data.get('column_values', [])]}")

                            if item_data and item_data.get('column_values'):
                                # Find column value
                                column_value = ""
                                for column in item_data.get('column_values', []):
                                    logging.info(f"Checking column: {column.get('id')} vs {source_column}")
                                    if column.get('id') == source_column:
                                        column_value = monday_api.get_column_value(column)
                                        logging.info(f"Found column value: '{column_value}' from column data: {column}")
                                        break

                                # Always set column_value, even if empty
                                processed_question['column_value'] = column_value if column_value else ""
                                logging.info(f"Set column_value to: '{processed_question['column_value']}'")

                                # Ensure destination_column is set for Monday column questions
                                if not processed_question.get('destination_column'):
                                    processed_question['destination_column'] = source_column
                                    logging.info(f"Set destination_column to: '{source_column}'")
                            else:
                                logging.warning("No item data or column values received from Monday.com")
                                processed_question['column_value'] = ""
                        except Exception as api_error:
                            logging.error(f"Monday.com API error: {str(api_error)}")
                            processed_question['column_value'] = ""
                    else:
                        logging.warning(f"Missing required data - item_id: {item_id}, source_column: {source_column}, board_a: {guias_config.get('board_a')}")
                        processed_question['column_value'] = ""
                except Exception as e:
                    logging.error(f"Error fetching Monday column data: {str(e)}")
                    processed_question['column_value'] = ""

            processed_questions.append(processed_question)

        # Generate form
        form_generator = FormGenerator()
        form_data = {
            "type": "guias",
            "title": "Formulário de Avaliação para Guias",
            "subtitle": "Avalie nossa viagem",
            "questions": processed_questions,
            "header_data": header_data,
            "webhook_data": webhook_data
        }

        form_id = form_generator.generate_form(form_data)
        form_url = f"{request.host_url}form/{form_id}"

        # Update Monday.com board if configured
        # Use board_a (source board) for the form link, since that's where the webhook originates
        if guias_config.get('board_a') and guias_config.get('link_column'):
            try:
                # Extract item ID from webhook data
                item_id = webhook_data.get('event', {}).get('pulseId')
                board_id = webhook_data.get('event', {}).get('boardId')
                if item_id and board_id:
                    monday_api.update_item_column(
                        board_id=board_id,  # Use the board ID from webhook
                        item_id=item_id,
                        column_id=guias_config['link_column'],
                        value=form_url
                    )
                    logging.info(f"Updated Monday.com board {board_id} with form URL")
            except Exception as e:
                logging.error(f"Failed to update Monday.com: {str(e)}")

        return jsonify({
            "success": True,
            "form_url": form_url,
            "form_id": form_id,
            "message": "Form generated successfully for Guias"
        })

    except Exception as e:
        logging.error(f"Error handling Guias webhook: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500